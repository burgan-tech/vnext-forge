import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Http2Server, Http2SecureServer } from 'node:http2';

import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

import { PtySession } from './pty-session.js';
import {
  assertPtyConnectionCapacityOk,
  assertPtyWebSocketOriginAllowed,
} from './pty-ws-policy.js';

const PTY_PATH = '/api/pty';

export interface PtyWebSocketInjectDeps {
  logger: LoggerAdapter;
  /** HTTP bind host (used with `isLoopbackHost` for Origin policy). */
  bindHost: string;
  corsAllowedOrigins: readonly string[];
  ptyMaxMessageBytes: number;
  ptyMaxConnections: number;
  /**
   * Optional cwd policy. Throw inside to refuse a `start` frame whose `cwd`
   * is outside approved roots; defaults to no-op (loopback-only host trust).
   */
  assertCwdAllowed?: (cwd: string) => void;
}

/**
 * Attach the integrated-terminal pty bridge to a Node HTTP server via
 * WebSockets at `/api/pty`. Mirrors `injectLspWebSocket` — same upgrade
 * policy, same per-connection bookkeeping, different protocol handler.
 */
export function injectPtyWebSocket(
  server: HttpServer | Http2Server | Http2SecureServer,
  deps: PtyWebSocketInjectDeps,
): void {
  const {
    logger,
    bindHost,
    corsAllowedOrigins,
    ptyMaxMessageBytes,
    ptyMaxConnections,
    assertCwdAllowed,
  } = deps;
  const wss = new WebSocketServer({ noServer: true });

  let activeConnections = 0;

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const sessionId = url.searchParams.get('session') ?? crypto.randomUUID();

    const session = new PtySession({
      ws,
      sessionId,
      logger,
      maxMessageBytes: ptyMaxMessageBytes,
      assertCwdAllowed,
    });
    session.attach();
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    ).pathname;

    if (pathname !== PTY_PATH) return;

    const origin = request.headers.origin;
    const originCheck = assertPtyWebSocketOriginAllowed(bindHost, origin, corsAllowedOrigins);
    if (!originCheck.ok) {
      logger.warn(
        { code: originCheck.code, origin, bindHost },
        'PTY WebSocket upgrade rejected (origin)',
      );
      socket.destroy();
      return;
    }

    const capacity = assertPtyConnectionCapacityOk(activeConnections, ptyMaxConnections);
    if (!capacity.ok) {
      logger.warn(
        { code: capacity.code, activeConnections, ptyMaxConnections },
        'PTY WebSocket upgrade rejected (max connections)',
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
      logger.error({ err, code: 'PTY_WS_UPGRADE_FAILED' }, 'PTY WebSocket handleUpgrade failed');
      socket.destroy();
    }
  });

  logger.info({ path: PTY_PATH }, 'PTY WebSocket endpoint registered');
}
