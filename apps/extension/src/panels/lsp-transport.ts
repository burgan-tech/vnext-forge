import * as vscode from 'vscode';

import type { LspClientTransport } from '@vnext-forge-studio/lsp-core';

/**
 * LSP transport wired to a VS Code webview `postMessage` channel. Replaces
 * the WebSocket transport that the standalone web-server uses.
 *
 * Wire protocol (webview ↔ extension host):
 *
 *   // extension host → webview
 *   { type: 'lsp', event: 'message', sessionId, data: <parsed JSON-RPC object> }
 *   { type: 'lsp', event: 'close',   sessionId, reason: string }
 *
 *   // webview → extension host
 *   { type: 'lsp', event: 'connect',    sessionId }
 *   { type: 'lsp', event: 'message',    sessionId, data: <raw JSON-RPC string> }
 *   { type: 'lsp', event: 'disconnect', sessionId }
 *
 * The router owns the `connect`/`disconnect` demultiplexing; this transport is
 * a single-session I/O pair that the bridge sees as a generic channel.
 */
export interface WebviewLspTransport extends LspClientTransport {
  /** Called by the router when a webview LSP message arrives. */
  deliverMessage(rawJson: string): void;
  /** Called when the webview disconnects (either explicitly or on disposal). */
  deliverClose(): void;
}

export function createWebviewLspTransport(
  panel: vscode.WebviewPanel,
  sessionId: string,
): WebviewLspTransport {
  let messageHandler: ((rawJson: string) => void) | undefined;
  let closeHandler: (() => void) | undefined;
  let closed = false;

  return {
    send(rawJson: string): void {
      if (closed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        parsed = rawJson;
      }
      void panel.webview.postMessage({
        type: 'lsp',
        event: 'message',
        sessionId,
        data: parsed,
      });
    },

    close(_code: number, reason: string): void {
      if (closed) return;
      closed = true;
      void panel.webview.postMessage({
        type: 'lsp',
        event: 'close',
        sessionId,
        reason,
      });
    },

    onMessage(handler: (rawJson: string) => void): void {
      messageHandler = handler;
    },

    onClose(handler: () => void): void {
      closeHandler = handler;
    },

    deliverMessage(rawJson: string): void {
      messageHandler?.(rawJson);
    },

    deliverClose(): void {
      if (closed) return;
      closed = true;
      closeHandler?.();
    },
  };
}
