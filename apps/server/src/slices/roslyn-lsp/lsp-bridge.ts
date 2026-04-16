import type { WebSocket } from 'ws'
import { baseLogger } from '@shared/lib/logger.js'
import { type OmniSharpSession, startOmniSharp } from './omnisharp-process.js'
import {
  type LspWorkspace,
  createLspWorkspace,
  updateScriptContent,
  destroyLspWorkspace,
  getWrapOffset,
} from './lsp-workspace.js'
import { ensureOmniSharp } from './omnisharp-installer.js'

const logger = baseLogger.child({ source: 'LspBridge' })

// ── Active sessions ───────────────────────────────────────────────────────────

interface BridgeSession {
  workspace: LspWorkspace
  lspServer: OmniSharpSession
  /** Monaco inmemory URI → file:// URI used by the LSP server */
  clientToServer: Map<string, string>
  /** Normalized file:// URI → Monaco inmemory URI (for reliable lookup) */
  serverToClient: Map<string, string>
  /**
   * Number of lines prepended to Script.cs by wrapCsxContent for the active
   * document. Used to shift publishDiagnostics ranges back to Monaco coords.
   * 0 when no wrapping was applied (script starts with using/#).
   */
  wrapOffset: number
}

/**
 * Pending session: holds messages queued from the client before the LSP server
 * is ready. handleLspConnect is async (workspace create + dotnet restore), so
 * client messages that arrive during setup are buffered here and flushed once
 * the real BridgeSession is registered in activeSessions.
 */
interface PendingSession {
  pending: true
  messageQueue: string[]
}

const activeSessions = new Map<string, BridgeSession | PendingSession>()

// ── URI helpers ───────────────────────────────────────────────────────────────

function scriptFileUri(workspace: LspWorkspace): string {
  // Normalize path separators and encode for URI
  const normalised = workspace.scriptPath.replace(/\\/g, '/')
  return normalised.startsWith('/') ? `file://${normalised}` : `file:///${normalised}`
}

/**
 * Normalizes a file:// URI for reliable Map lookups.
 * Decodes percent-encoding, lowercases the path on case-insensitive systems,
 * and removes any trailing slashes.
 */
function normalizeFileUri(uri: string): string {
  try {
    // decodeURIComponent handles %20 and similar encodings
    const decoded = decodeURIComponent(uri)
    // On macOS/Windows paths are case-insensitive; normalize to lowercase
    // so csharp-ls capitalisation variants still match.
    return decoded.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')
  } catch {
    return uri.toLowerCase()
  }
}

/**
 * Rewrites outgoing (client → server) message URIs from Monaco inmemory://
 * to the file:// URI that csharp-ls understands.
 */
function rewriteOutgoing(msg: any, session: BridgeSession): any {
  const uri: string | undefined = msg.params?.textDocument?.uri
  if (!uri) return msg

  const serverUri = session.clientToServer.get(uri)
  if (!serverUri) return msg

  return {
    ...msg,
    params: {
      ...msg.params,
      textDocument: { ...msg.params.textDocument, uri: serverUri },
    },
  }
}

/**
 * Rewrites incoming (server → client) message URIs from file:// back to the
 * Monaco inmemory:// URI so Monaco can match the model.
 *
 * Handles:
 *   - textDocument/publishDiagnostics  → params.uri + range line shift
 *   - textDocument/hover, completion, etc. (no URI in response body, skipped)
 */
function rewriteIncoming(msg: any, session: BridgeSession): any {
  // publishDiagnostics carries uri at the top of params, not inside textDocument
  const uri: string | undefined = msg.params?.uri
  if (!uri) return msg

  // Use normalized URI for lookup to handle csharp-ls encoding/casing variants
  const clientUri = session.serverToClient.get(normalizeFileUri(uri))
  if (!clientUri) return msg

  const rewritten = { ...msg, params: { ...msg.params, uri: clientUri } }

  // Shift diagnostic line numbers back by the number of lines wrapCsxContent
  // prepended so they align with the original Monaco document positions.
  if (msg.method === 'textDocument/publishDiagnostics' && session.wrapOffset > 0) {
    const offset = session.wrapOffset
    const shifted = (rewritten.params.diagnostics ?? []).map((d: any) => ({
      ...d,
      range: {
        start: {
          line: Math.max(0, (d.range?.start?.line ?? 0) - offset),
          character: d.range?.start?.character ?? 0,
        },
        end: {
          line: Math.max(0, (d.range?.end?.line ?? 0) - offset),
          character: d.range?.end?.character ?? 0,
        },
      },
    }))
    rewritten.params = { ...rewritten.params, diagnostics: shifted }
  }

  return rewritten
}

// ── Bridge lifecycle ──────────────────────────────────────────────────────────

export async function handleLspConnect(ws: WebSocket, sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client connected')

  // Register a pending slot immediately so that handleLspMessage can queue
  // messages that arrive while the workspace and LSP process are being set up.
  activeSessions.set(sessionId, { pending: true, messageQueue: [] })

  let serverInfo: Awaited<ReturnType<typeof ensureOmniSharp>>
  try {
    serverInfo = await ensureOmniSharp()
  } catch (err: any) {
    logger.error({ err, sessionId }, 'No LSP server available — closing WebSocket')
    activeSessions.delete(sessionId)
    ws.close(1011, Buffer.from('LSP server unavailable'))
    return
  }

  let workspace: LspWorkspace
  try {
    workspace = await createLspWorkspace(sessionId)
  } catch (err: any) {
    logger.error({ err, sessionId }, 'Failed to create LSP workspace — closing WebSocket')
    activeSessions.delete(sessionId)
    ws.close(1011, Buffer.from('Workspace creation failed'))
    return
  }

  const lspServer = startOmniSharp(
    sessionId,
    workspace.workspacePath,
    serverInfo.executablePath,
    serverInfo.serverType,
  )

  const session: BridgeSession = {
    workspace,
    lspServer,
    clientToServer: new Map(),
    serverToClient: new Map(),
    wrapOffset: 0,
  }

  // LSP server → WebSocket (rewrite file:// URIs back to client URIs)
  lspServer.onMessage((rawMsg: any) => {
    try {
      // Log diagnostics before rewriting so we can see what URI csharp-ls sends
      if ((rawMsg as any).method === 'textDocument/publishDiagnostics') {
        const d = rawMsg as any
        logger.info(
          { sessionId, uri: d.params?.uri, count: d.params?.diagnostics?.length ?? 0 },
          'publishDiagnostics received from LSP server',
        )
      }
      const msg = rewriteIncoming(rawMsg, session)
      if ((msg as any).method === 'textDocument/publishDiagnostics') {
        const d = msg as any
        logger.info(
          { sessionId, uri: d.params?.uri, count: d.params?.diagnostics?.length ?? 0 },
          'publishDiagnostics forwarded to WebSocket client',
        )
      }
      ws.send(JSON.stringify(msg))
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to forward LSP message to WebSocket')
    }
  })

  // Retrieve any messages that arrived while we were setting up and replay them.
  // If the client disconnected during setup, activeSessions will have been
  // deleted by handleLspDisconnect — abort cleanly in that case.
  const pendingEntry = activeSessions.get(sessionId)
  if (!pendingEntry) {
    logger.info({ sessionId }, 'Client disconnected during LSP setup — aborting')
    lspServer.dispose()
    await destroyLspWorkspace(workspace)
    return
  }
  const queued = 'pending' in pendingEntry ? pendingEntry.messageQueue : []

  // Replace the pending slot with the real session before flushing the queue
  // so that processLspMessage can operate on the fully initialised session.
  activeSessions.set(sessionId, session)

  if (queued.length > 0) {
    logger.info({ sessionId, count: queued.length }, 'Flushing queued LSP messages')
    for (const raw of queued) {
      processLspMessage(session, raw)
    }
  }
}

/**
 * Processes a raw JSON string message from the client against a fully
 * initialised BridgeSession. Extracted so it can be called both from the
 * live message handler and from the startup queue flush.
 */
function processLspMessage(session: BridgeSession, rawMessage: string): void {
  const { sessionId } = session.lspServer

  let msg: any
  try {
    msg = JSON.parse(rawMessage)
  } catch {
    logger.warn({ sessionId }, 'Received malformed JSON from LSP client')
    return
  }

  // ── initialize: inject workspace root so csharp-ls finds the .csproj ─────
  if (msg.method === 'initialize' && msg.params) {
    const workspaceUri = `file://${session.workspace.workspacePath.replace(/\\/g, '/')}`
    msg = {
      ...msg,
      params: {
        ...msg.params,
        rootUri: workspaceUri,
        rootPath: session.workspace.workspacePath,
        workspaceFolders: [{ uri: workspaceUri, name: 'vnext-script' }],
      },
    }
  }

  // ── textDocument/didOpen: register URI mapping + rewrite ─────────────────
  if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.uri) {
    const clientUri: string = msg.params.textDocument.uri
    const serverUri = scriptFileUri(session.workspace)

    if (!session.clientToServer.has(clientUri)) {
      session.clientToServer.set(clientUri, serverUri)
      // Store under normalized key so csharp-ls URI variants still match
      session.serverToClient.set(normalizeFileUri(serverUri), clientUri)
      logger.info({ sessionId, clientUri, serverUri }, 'LSP document URI mapping registered')
    }

    // Also keep Script.cs in sync with the opened content
    const text: string | undefined = msg.params.textDocument.text
    if (text !== undefined) {
      session.wrapOffset = getWrapOffset(text)
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
      )
    }

    msg = rewriteOutgoing(msg, session)
  }

  // ── textDocument/didChange: keep Script.cs in sync + rewrite URI ──────────
  if (msg.method === 'textDocument/didChange') {
    const clientUri: string | undefined = msg.params?.textDocument?.uri
    // Update reverse mapping so publishDiagnostics returns to the currently active model
    if (clientUri) {
      const serverUri = session.clientToServer.get(clientUri)
      if (serverUri) session.serverToClient.set(normalizeFileUri(serverUri), clientUri)
    }
    const text: string | undefined = msg.params?.contentChanges?.[0]?.text
    if (text !== undefined) {
      session.wrapOffset = getWrapOffset(text)
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror script content'),
      )
    }
    msg = rewriteOutgoing(msg, session)
  }

  // ── All other textDocument/* requests: rewrite URI ────────────────────────
  if (
    msg.method?.startsWith('textDocument/') &&
    msg.method !== 'textDocument/didOpen' &&
    msg.method !== 'textDocument/didChange'
  ) {
    msg = rewriteOutgoing(msg, session)
  }

  session.lspServer.send(msg)
}

export function handleLspMessage(sessionId: string, rawMessage: string): void {
  const entry = activeSessions.get(sessionId)
  if (!entry) return

  // If the session is still initialising, buffer the message for later replay
  if ('pending' in entry) {
    entry.messageQueue.push(rawMessage)
    return
  }

  processLspMessage(entry, rawMessage)
}

export async function handleLspDisconnect(sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client disconnected')

  const entry = activeSessions.get(sessionId)
  if (!entry) return

  activeSessions.delete(sessionId)

  // If still pending (setup was in progress), nothing to tear down yet —
  // handleLspConnect will check activeSessions and skip the flush.
  if ('pending' in entry) return

  entry.lspServer.dispose()
  await destroyLspWorkspace(entry.workspace)
}
