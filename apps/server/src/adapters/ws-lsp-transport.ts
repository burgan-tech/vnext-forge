import type { RawData, WebSocket } from 'ws';

import type { LspClientTransport } from '@vnext-forge-studio/lsp-core';
import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

import {
  assertLspInboundMessageSizeOk,
} from '../lsp/lsp-ws-policy.js';

function rawDataByteLength(data: RawData): number {
  if (typeof data === 'string') {
    return Buffer.byteLength(data);
  }
  if (Buffer.isBuffer(data)) {
    return data.byteLength;
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
}

export interface WsLspTransportOptions {
  maxMessageBytes: number;
  logger: LoggerAdapter;
  sessionId: string;
}

/**
 * Adapt a `ws.WebSocket` to the transport-agnostic `LspClientTransport`
 * contract consumed by `@vnext-forge-studio/lsp-core`.
 *
 * Enforces a max inbound message size (R-b16); oversize frames close with
 * WebSocket code 1009.
 */
export function createWsLspTransport(
  ws: WebSocket,
  options: WsLspTransportOptions,
): LspClientTransport {
  const { maxMessageBytes, logger, sessionId } = options;

  return {
    send(rawJson) {
      ws.send(rawJson);
    },
    close(code, reason) {
      ws.close(code, reason);
    },
    onMessage(handler) {
      ws.on('message', (data: RawData) => {
        const byteLength = rawDataByteLength(data);
        const sizeCheck = assertLspInboundMessageSizeOk(byteLength, maxMessageBytes);
        if (!sizeCheck.ok) {
          logger.warn(
            { code: sizeCheck.code, sessionId, byteLength, maxMessageBytes },
            'LSP WebSocket inbound message rejected (oversize)',
          );
          ws.close(1009, 'message too large');
          return;
        }
        const asString =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
              ? data.toString('utf-8')
              : data instanceof ArrayBuffer
                ? Buffer.from(data).toString('utf-8')
                : Buffer.concat(data).toString('utf-8');
        handler(asString);
      });
    },
    onClose(handler) {
      ws.on('close', () => {
        handler();
      });
    },
  };
}
