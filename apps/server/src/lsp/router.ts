import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Http2Server, Http2SecureServer } from 'node:http2';

import type { LspBridge } from '@vnext-forge/lsp-core';
import type { LoggerAdapter } from '@vnext-forge/services-core';

import { createWsLspTransport } from '../adapters/ws-lsp-transport.js';

const LSP_PATH = '/api/lsp/csharp';

/**
 * Attach the shared `lsp-core` bridge to a Node HTTP server via WebSockets.
 * Each incoming upgrade at `/api/lsp/csharp` gets its own session id (from the
 * `session` query param, or a generated UUID) and a fresh `LspClientTransport`
 * that is handed to the bridge.
 */
export function injectLspWebSocket(
  server: HttpServer | Http2Server | Http2SecureServer,
  deps: { bridge: LspBridge; logger: LoggerAdapter },
): void {
  const { bridge, logger } = deps;
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const sessionId = url.searchParams.get('session') ?? crypto.randomUUID();
    const transport = createWsLspTransport(ws);

    bridge.connect(sessionId, transport).catch((err: unknown) => {
      logger.error({ err, sessionId }, 'LSP connect handler failed');
      ws.close(1011, 'Internal error');
    });

    ws.on('error', (err) => {
      logger.warn({ err, sessionId }, 'LSP WebSocket error');
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    ).pathname;

    if (pathname === LSP_PATH) {
      wss.handleUpgrade(request, socket as never, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  logger.info({ path: LSP_PATH }, 'LSP WebSocket endpoint registered');
}
