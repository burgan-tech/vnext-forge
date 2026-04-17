import { baseLogger } from '@ext/shared/logger'
import { type OmniSharpSession, startOmniSharp } from './omnisharp-process'
import {
  type LspWorkspace,
  createLspWorkspace,
  updateScriptContent,
  destroyLspWorkspace,
  getWrapOffset,
} from './lsp-workspace'
import { ensureOmniSharp } from './omnisharp-installer'

const logger = baseLogger.child({ source: 'LspBridge' })

// ── LspSocket ─────────────────────────────────────────────────────────────────

/**
 * Minimal socket interface used by the bridge.
 * The extension host provides a WebviewLspAdapter that implements this instead
 * of the ws.WebSocket used by the original BFF server.
 */
export interface LspSocket {
  send(data: string): void
  close(code?: number, reason?: Buffer | string): void
}

// ── Active sessions ───────────────────────────────────────────────────────────

interface BridgeSession {
  workspace: LspWorkspace
  lspServer: OmniSharpSession
  clientToServer: Map<string, string>
  serverToClient: Map<string, string>
  wrapOffset: number
}

interface PendingSession {
  pending: true
  messageQueue: string[]
}

const activeSessions = new Map<string, BridgeSession | PendingSession>()

// ── URI helpers ───────────────────────────────────────────────────────────────

function scriptFileUri(workspace: LspWorkspace): string {
  const normalised = workspace.scriptPath.replace(/\\/g, '/')
  return normalised.startsWith('/') ? `file://${normalised}` : `file:///${normalised}`
}

function normalizeFileUri(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri)
    return decoded.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')
  } catch {
    return uri.toLowerCase()
  }
}

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

function rewriteIncoming(msg: any, session: BridgeSession): any {
  const uri: string | undefined = msg.params?.uri
  if (!uri) return msg

  const clientUri = session.serverToClient.get(normalizeFileUri(uri))
  if (!clientUri) return msg

  const rewritten = { ...msg, params: { ...msg.params, uri: clientUri } }

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

export async function handleLspConnect(socket: LspSocket, sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client connected')

  activeSessions.set(sessionId, { pending: true, messageQueue: [] })

  let serverInfo: Awaited<ReturnType<typeof ensureOmniSharp>>
  try {
    serverInfo = await ensureOmniSharp()
  } catch (err: any) {
    logger.error({ err, sessionId }, 'No LSP server available — closing socket')
    activeSessions.delete(sessionId)
    socket.close(1011, Buffer.from('LSP server unavailable'))
    return
  }

  let workspace: LspWorkspace
  try {
    workspace = await createLspWorkspace(sessionId)
  } catch (err: any) {
    logger.error({ err, sessionId }, 'Failed to create LSP workspace — closing socket')
    activeSessions.delete(sessionId)
    socket.close(1011, Buffer.from('Workspace creation failed'))
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

  // LSP server → socket (rewrite file:// URIs back to client URIs)
  lspServer.onMessage((rawMsg: any) => {
    try {
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
          'publishDiagnostics forwarded to socket',
        )
      }
      socket.send(JSON.stringify(msg))
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to forward LSP message to socket')
    }
  })

  const pendingEntry = activeSessions.get(sessionId)
  if (!pendingEntry) {
    logger.info({ sessionId }, 'Client disconnected during LSP setup — aborting')
    lspServer.dispose()
    await destroyLspWorkspace(workspace)
    return
  }
  const queued = 'pending' in pendingEntry ? pendingEntry.messageQueue : []

  activeSessions.set(sessionId, session)

  if (queued.length > 0) {
    logger.info({ sessionId, count: queued.length }, 'Flushing queued LSP messages')
    for (const raw of queued) {
      processLspMessage(session, raw)
    }
  }
}

function processLspMessage(session: BridgeSession, rawMessage: string): void {
  const { sessionId } = session.lspServer

  let msg: any
  try {
    msg = JSON.parse(rawMessage)
  } catch {
    logger.warn({ sessionId }, 'Received malformed JSON from LSP client')
    return
  }

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

  if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.uri) {
    const clientUri: string = msg.params.textDocument.uri
    const serverUri = scriptFileUri(session.workspace)

    if (!session.clientToServer.has(clientUri)) {
      session.clientToServer.set(clientUri, serverUri)
      session.serverToClient.set(normalizeFileUri(serverUri), clientUri)
      logger.info({ sessionId, clientUri, serverUri }, 'LSP document URI mapping registered')
    }

    const text: string | undefined = msg.params.textDocument.text
    if (text !== undefined) {
      session.wrapOffset = getWrapOffset(text)
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
      )
    }

    msg = rewriteOutgoing(msg, session)
  }

  if (msg.method === 'textDocument/didChange') {
    const clientUri: string | undefined = msg.params?.textDocument?.uri
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

  if ('pending' in entry) return

  entry.lspServer.dispose()
  await destroyLspWorkspace(entry.workspace)
}
