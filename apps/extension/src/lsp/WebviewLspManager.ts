import * as vscode from 'vscode'
import { baseLogger } from '@ext/shared/logger'
import { handleLspConnect, handleLspDisconnect, handleLspMessage, type LspSocket } from './lsp-bridge'

const logger = baseLogger.child({ source: 'WebviewLspManager' })

// ── Webview → host message shapes ─────────────────────────────────────────────

export interface LspConnectMsg {
  type: 'lsp'
  event: 'connect'
  sessionId: string
}

export interface LspMessageMsg {
  type: 'lsp'
  event: 'message'
  sessionId: string
  /** Raw JSON-RPC string */
  data: string
}

export interface LspDisconnectMsg {
  type: 'lsp'
  event: 'disconnect'
  sessionId: string
}

export type LspWebviewMessage = LspConnectMsg | LspMessageMsg | LspDisconnectMsg

export function isLspWebviewMessage(value: unknown): value is LspWebviewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).type === 'lsp' &&
    typeof (value as any).event === 'string' &&
    typeof (value as any).sessionId === 'string'
  )
}

// ── Manager ───────────────────────────────────────────────────────────────────

/**
 * Routes LSP postMessages between the webview and lsp-bridge.
 * Replaces the WebSocket server + ws upgrade from the original BFF.
 */
export class WebviewLspManager {
  private readonly activeSessions = new Set<string>()

  /**
   * Called when the webview sends { type: 'lsp', event: 'connect', sessionId }.
   * Creates a LspSocket backed by panel.webview.postMessage and starts the bridge.
   */
  async onConnect(panel: vscode.WebviewPanel, sessionId: string): Promise<void> {
    this.activeSessions.add(sessionId)
    logger.info({ sessionId }, 'LSP connect request from webview')

    const socket: LspSocket = {
      send(data: string): void {
        try {
          // Forward LSP JSON-RPC (already a string) as a parsed object so the
          // webview can dispatch it without a second JSON.parse round-trip.
          panel.webview.postMessage({
            type: 'lsp',
            event: 'message',
            data: JSON.parse(data),
          })
        } catch (err) {
          logger.warn({ err, sessionId }, 'Failed to forward LSP message to webview')
        }
      },

      close(_code?: number, reason?: Buffer | string): void {
        // Signal the webview to tear down its virtual connection.
        panel.webview.postMessage({
          type: 'lsp',
          event: 'close',
          reason: reason?.toString() ?? 'closed',
        })
        logger.info({ sessionId, reason: reason?.toString() }, 'LSP socket closed by bridge')
      },
    }

    // handleLspConnect is async — run it non-blocking to avoid stalling the
    // MessageRouter message handler. Errors are logged, not re-thrown.
    handleLspConnect(socket, sessionId).catch((err) => {
      logger.error({ err, sessionId }, 'LSP connect failed')
    })
  }

  /** Called when the webview sends { type: 'lsp', event: 'message', data }. */
  onMessage(sessionId: string, rawMessage: string): void {
    handleLspMessage(sessionId, rawMessage)
  }

  /** Called when the webview sends { type: 'lsp', event: 'disconnect' }. */
  onDisconnect(sessionId: string): void {
    this.activeSessions.delete(sessionId)
    handleLspDisconnect(sessionId).catch((err) => {
      logger.error({ err, sessionId }, 'LSP disconnect failed')
    })
  }

  /** Tear down all active sessions (called when the webview panel is disposed). */
  disposeAll(): void {
    const ids = [...this.activeSessions]
    this.activeSessions.clear()
    for (const id of ids) {
      handleLspDisconnect(id).catch((err) => {
        logger.error({ err, sessionId: id }, 'LSP cleanup on panel dispose failed')
      })
    }
  }
}
