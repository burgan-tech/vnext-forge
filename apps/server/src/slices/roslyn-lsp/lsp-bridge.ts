import type { WebSocket } from 'ws'
import { baseLogger } from '@shared/lib/logger.js'
import { type OmniSharpSession, startOmniSharp } from './omnisharp-process.js'
import {
  type LspWorkspace,
  createLspWorkspace,
  updateScriptContent,
  destroyLspWorkspace,
} from './lsp-workspace.js'
import { ensureOmniSharp } from './omnisharp-installer.js'

const logger = baseLogger.child({ source: 'LspBridge' })

// ── Active sessions ───────────────────────────────────────────────────────────

interface BridgeSession {
  workspace: LspWorkspace
  lspServer: OmniSharpSession
  /** Monaco inmemory URI → file:// URI used by the LSP server */
  clientToServer: Map<string, string>
  /** file:// URI used by LSP server → Monaco inmemory URI */
  serverToClient: Map<string, string>
}

const activeSessions = new Map<string, BridgeSession>()

// ── URI helpers ───────────────────────────────────────────────────────────────

function scriptFileUri(workspace: LspWorkspace): string {
  // Normalize path separators and encode for URI
  const normalised = workspace.scriptPath.replace(/\\/g, '/')
  return normalised.startsWith('/') ? `file://${normalised}` : `file:///${normalised}`
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
 *   - textDocument/publishDiagnostics  → params.uri
 *   - textDocument/hover, completion, etc. (no URI in response body, skipped)
 */
function rewriteIncoming(msg: any, session: BridgeSession): any {
  // publishDiagnostics carries uri at the top of params, not inside textDocument
  const uri: string | undefined = msg.params?.uri
  if (!uri) return msg

  const clientUri = session.serverToClient.get(uri)
  if (!clientUri) return msg

  return {
    ...msg,
    params: { ...msg.params, uri: clientUri },
  }
}

// ── Bridge lifecycle ──────────────────────────────────────────────────────────

export async function handleLspConnect(ws: WebSocket, sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client connected')

  let serverInfo: Awaited<ReturnType<typeof ensureOmniSharp>>
  try {
    serverInfo = await ensureOmniSharp()
  } catch (err: any) {
    logger.error({ err, sessionId }, 'No LSP server available — closing WebSocket')
    ws.close(1011, Buffer.from('LSP server unavailable'))
    return
  }

  let workspace: LspWorkspace
  try {
    workspace = await createLspWorkspace(sessionId)
  } catch (err: any) {
    logger.error({ err, sessionId }, 'Failed to create LSP workspace — closing WebSocket')
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
  }

  // LSP server → WebSocket (rewrite file:// URIs back to client URIs)
  lspServer.onMessage((rawMsg) => {
    try {
      const msg = rewriteIncoming(rawMsg, session)
      ws.send(JSON.stringify(msg))
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to forward LSP message to WebSocket')
    }
  })

  activeSessions.set(sessionId, session)
}

export function handleLspMessage(sessionId: string, rawMessage: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) return

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
      session.serverToClient.set(serverUri, clientUri)
      logger.info({ sessionId, clientUri, serverUri }, 'LSP document URI mapping registered')
    }

    // Also keep Script.cs in sync with the opened content
    const text: string | undefined = msg.params.textDocument.text
    if (text !== undefined) {
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
      )
    }

    msg = rewriteOutgoing(msg, session)
  }

  // ── textDocument/didChange: keep Script.cs in sync + rewrite URI ──────────
  if (msg.method === 'textDocument/didChange') {
    const text: string | undefined = msg.params?.contentChanges?.[0]?.text
    if (text !== undefined) {
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

export async function handleLspDisconnect(sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client disconnected')

  const session = activeSessions.get(sessionId)
  if (!session) return

  activeSessions.delete(sessionId)
  session.lspServer.dispose()
  await destroyLspWorkspace(session.workspace)
}
