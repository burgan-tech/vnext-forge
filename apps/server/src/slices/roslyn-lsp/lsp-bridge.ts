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
  omniSharp: OmniSharpSession
}

const activeSessions = new Map<string, BridgeSession>()

// ── Bridge lifecycle ──────────────────────────────────────────────────────────

/**
 * Called when a WebSocket client connects to /api/lsp/csharp.
 * Sets up the workspace, starts OmniSharp, and wires the bidirectional bridge.
 */
export async function handleLspConnect(ws: WebSocket, sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client connected')

  let omnisharpPath: string
  try {
    omnisharpPath = await ensureOmniSharp()
  } catch (err: any) {
    logger.error({ err, sessionId }, 'OmniSharp unavailable — closing LSP WebSocket')
    ws.close(1011, Buffer.from('OmniSharp unavailable'))
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

  const omniSharp = startOmniSharp(sessionId, workspace.workspacePath, omnisharpPath)

  // OmniSharp → WebSocket
  omniSharp.onMessage((msg) => {
    try {
      ws.send(JSON.stringify(msg))
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to forward OmniSharp message to WebSocket')
    }
  })

  activeSessions.set(sessionId, { workspace, omniSharp })
}

/**
 * Called when the WebSocket receives a message from the Monaco LSP client.
 * Forwards the JSON-RPC message to OmniSharp.
 *
 * Intercepts textDocument/didOpen and textDocument/didChange to keep
 * Script.cs in sync with what Monaco has open.
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

  // Mirror script content changes to the workspace file so Roslyn reflects them
  if (msg.method === 'textDocument/didChange' && msg.params?.contentChanges) {
    const text = msg.params.contentChanges[0]?.text
    if (text !== undefined) {
      updateScriptContent(session.workspace, text).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror script content to workspace'),
      )
    }
  }

  if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.text) {
    const text = msg.params.textDocument.text
    updateScriptContent(session.workspace, text).catch((err) =>
      logger.warn({ err, sessionId }, 'Failed to mirror opened document to workspace'),
    )
  }

  session.omniSharp.send(msg)
}

/**
 * Called when the WebSocket client disconnects.
 * Tears down OmniSharp and removes the temporary workspace.
 */
export async function handleLspDisconnect(sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'LSP client disconnected')

  const session = activeSessions.get(sessionId)
  if (!session) return

  activeSessions.delete(sessionId)
  session.omniSharp.dispose()
  await destroyLspWorkspace(session.workspace)
}
