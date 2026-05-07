import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Http2Server, Http2SecureServer } from 'node:http2';

import type { LspBridge } from '@vnext-forge-studio/lsp-core';
import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

import { createWsLspTransport } from '../adapters/ws-lsp-transport.js';
import {
  assertLspConnectionCapacityOk,
  assertLspWebSocketOriginAllowed,
} from './lsp-ws-policy.js';

const LSP_PATH = '/api/lsp/csharp';

export interface LspWebSocketInjectDeps {
  bridge: LspBridge;
  logger: LoggerAdapter;
  /** HTTP bind host (used with `isLoopbackHost` for Origin policy). */
  bindHost: string;
  corsAllowedOrigins: readonly string[];
  lspMaxMessageBytes: number;
  lspMaxConnections: number;
}

/**
 * Attach the shared `lsp-core` bridge to a Node HTTP server via WebSockets.
 * Each incoming upgrade at `/api/lsp/csharp` gets its own session id (from the
 * `session` query param, or a generated UUID) and a fresh `LspClientTransport`
 * that is handed to the bridge.
 */
export function injectLspWebSocket(
  server: HttpServer | Http2Server | Http2SecureServer,
  deps: LspWebSocketInjectDeps,
): void {
  const {
    bridge,
    logger,
    bindHost,
    corsAllowedOrigins,
    lspMaxMessageBytes,
    lspMaxConnections,
  } = deps;
  const wss = new WebSocketServer({ noServer: true });

  let activeConnections = 0;

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const sessionId = url.searchParams.get('session') ?? crypto.randomUUID();
    const transport = createWsLspTransport(ws, {
      maxMessageBytes: lspMaxMessageBytes,
      logger,
      sessionId,
    });

    bridge.connect(sessionId, transport).catch((err: unknown) => {
      logger.error({ err, sessionId, code: 'LSP_WS_CONNECT_FAILED' }, 'LSP connect handler failed');
      ws.close(1011, 'Internal error');
    });

    ws.on('error', (err) => {
      logger.warn({ err, sessionId, code: 'LSP_WS_SOCKET_ERROR' }, 'LSP WebSocket error');
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    ).pathname;

    if (pathname !== LSP_PATH) {
      return;
    }

    const origin = request.headers.origin;
    const originCheck = assertLspWebSocketOriginAllowed(bindHost, origin, corsAllowedOrigins);
    if (!originCheck.ok) {
      logger.warn(
        { code: originCheck.code, origin, bindHost },
        'LSP WebSocket upgrade rejected (origin)',
      );
      socket.destroy();
      return;
    }

    const capacity = assertLspConnectionCapacityOk(activeConnections, lspMaxConnections);
    if (!capacity.ok) {
      logger.warn(
        { code: capacity.code, activeConnections, lspMaxConnections },
        'LSP WebSocket upgrade rejected (max connections)',
      );
      socket.destroy();
      return;
    }

    activeConnections += 1;
    try {
      wss.handleUpgrade(request, socket as never, head, (ws) => {
        ws.once('close', () => {
          activeConnections -= 1;
        });
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      activeConnections -= 1;
      logger.error({ err, code: 'LSP_WS_UPGRADE_FAILED' }, 'LSP WebSocket handleUpgrade failed');
      socket.destroy();
    }
  });

  logger.info({ path: LSP_PATH }, 'LSP WebSocket endpoint registered');
}
