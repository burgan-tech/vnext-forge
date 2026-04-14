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
}

const activeSessions = new Map<string, BridgeSession>()

// ── Bridge lifecycle ──────────────────────────────────────────────────────────

/**
 * Called when a WebSocket client connects to /api/lsp/csharp.
 * Sets up the workspace, starts the LSP server, and wires the bidirectional bridge.
 */
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

  // LSP server → WebSocket
  lspServer.onMessage((msg) => {
    try {
      ws.send(JSON.stringify(msg))
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to forward LSP message to WebSocket')
    }
  })

  activeSessions.set(sessionId, { workspace, lspServer })
}

/**
 * Called when the WebSocket receives a message from the Monaco LSP client.
 * Forwards the JSON-RPC message to the LSP server.
 *
 * Intercepts:
 *   - initialize     → injects rootUri / rootPath so csharp-ls can find the project
 *   - didOpen/didChange → mirrors content to Script.cs in the temp workspace
 */
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

  // Inject workspace root into initialize so csharp-ls can load the .csproj
  if (msg.method === 'initialize' && msg.params) {
    const workspaceUri = `file://${session.workspace.workspacePath}`
    msg.params = {
      ...msg.params,
      rootUri: workspaceUri,
      rootPath: session.workspace.workspacePath,
      workspaceFolders: [{ uri: workspaceUri, name: 'vnext-script' }],
    }
  }

  // Mirror script content to workspace so Roslyn stays in sync with Monaco
  if (msg.method === 'textDocument/didChange' && msg.params?.contentChanges) {
    const text = msg.params.contentChanges[0]?.text
    if (text !== undefined) {
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror script content'),
      )
    }
  }

  if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.text) {
    updateScriptContent(session.workspace, msg.params.textDocument.text).catch((err) =>
      logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
    )
  }

  session.lspServer.send(msg)
}

/**
 * Called when the WebSocket client disconnects.
 * Tears down the LSP server process and removes the temporary workspace.
 */
export async function handleLspDisconnect(sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client disconnected')

  const session = activeSessions.get(sessionId)
  if (!session) return

  activeSessions.delete(sessionId)
  session.lspServer.dispose()
  await destroyLspWorkspace(session.workspace)
}
