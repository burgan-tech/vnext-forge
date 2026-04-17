import type { WebSocket } from 'ws';

import type { LspClientTransport } from '@vnext-forge/lsp-core';

/**
 * Adapt a `ws.WebSocket` to the transport-agnostic `LspClientTransport`
 * contract consumed by `@vnext-forge/lsp-core`.
 *
 * The bridge subscribes to the editor side via `onMessage` / `onClose` once
 * and pushes Roslyn-bound frames back through `send()`. The extension shell
 * provides its own postMessage-based transport instead of this one.
 */
export function createWsLspTransport(ws: WebSocket): LspClientTransport {
  return {
    send(rawJson) {
      ws.send(rawJson);
    },
    close(code, reason) {
      ws.close(code, reason);
    },
    onMessage(handler) {
      ws.on('message', (data) => {
        handler(data.toString());
      });
    },
    onClose(handler) {
      ws.on('close', () => {
        handler();
      });
    },
  };
}
