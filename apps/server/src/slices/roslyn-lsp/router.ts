import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Http2Server, Http2SecureServer } from 'node:http2';
import { baseLogger } from '@shared/lib/logger.js';
import { handleLspConnect, handleLspMessage, handleLspDisconnect } from './lsp-bridge.js';

const logger = baseLogger.child({ source: 'RoslynLspRouter' });

const wss = new WebSocketServer({ noServer: true });

// ── WebSocket connection handler ──────────────────────────────────────────────

wss.on('connection', (ws, request) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const sessionId = url.searchParams.get('session') ?? crypto.randomUUID();

  handleLspConnect(ws, sessionId).catch((err) => {
    logger.error({ err, sessionId }, 'LSP connect handler failed');
    ws.close(1011, 'Internal error');
  });

  ws.on('message', (data) => {
    handleLspMessage(sessionId, data.toString());
  });

  ws.on('close', () => {
    handleLspDisconnect(sessionId).catch((err) => {
      logger.warn({ err, sessionId }, 'LSP disconnect handler failed');
    });
  });

  ws.on('error', (err) => {
    logger.warn({ err, sessionId }, 'LSP WebSocket error');
  });
});

// ── HTTP Upgrade injection ────────────────────────────────────────────────────

const LSP_PATH = '/api/lsp/csharp';

/**
 * Attaches the Roslyn LSP WebSocket handler to the Node.js HTTP server.
 * Must be called after `serve()` from @hono/node-server.
 *
 * Intercepts HTTP upgrade requests to /api/lsp/csharp and hands them
 * off to the ws.WebSocketServer. All other upgrade requests are passed through.
 */
export function injectRoslynWebSocket(server: HttpServer | Http2Server | Http2SecureServer): void {
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    ).pathname;

    if (pathname === LSP_PATH) {
      wss.handleUpgrade(request, socket as any, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Anything else: let Node.js default handling proceed (socket remains open)
  });

  logger.info({ path: LSP_PATH }, 'Roslyn LSP WebSocket endpoint registered');
}
