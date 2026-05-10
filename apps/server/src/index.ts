import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';

import { createPinoLoggerAdapter } from './adapters/pino-logger.js';
import { composeLspBridge } from './composition/lsp.js';
import { composeWebServerServices } from './composition/services.js';
import { injectLspWebSocket } from './lsp/router.js';
import { injectPtyWebSocket } from './pty/router.js';
import { createApiV1Router } from './api/v1/index.js';
import { config } from './shared/config/config.js';
import { baseLogger } from './shared/lib/logger.js';
import { ok } from './shared/lib/response-helpers.js';
import { bodyLimitMiddleware } from './shared/middleware/body-limit.js';
import { errorHandler, jsonErrorResponse } from './shared/middleware/error-handler.js';
import { requestLoggerMiddleware } from './shared/middleware/logger.js';
import { traceIdMiddleware } from './shared/middleware/trace-id.js';
import type { Variables } from './shared/types/hono.js';

const loggerAdapter = createPinoLoggerAdapter(baseLogger);
const { services, registry } = composeWebServerServices(loggerAdapter);
const apiV1Router = createApiV1Router({ registry, services });

// Explicit allowlist — wildcard `*` is only acceptable for fully public APIs
// and we intentionally do not run this server in that mode. Browser shells
// must originate from one of `config.corsAllowedOrigins`.
const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return origin // non-browser callers (curl, server-to-server)
    return config.corsAllowedOrigins.includes(origin) ? origin : null;
  },
  credentials: false,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // `X-Trace-Id` + W3C `traceparent`/`tracestate` are part of the `trace-v1`
  // contract — see ADR-002 and `apps/web/src/shared/api/trace-headers.ts`.
  // Browsers reject the preflight if any of these are missing here.
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Trace-Id',
    'traceparent',
    'tracestate',
  ],
  exposeHeaders: ['X-Trace-Id'],
});

const app = new Hono<{ Variables: Variables }>()
  .use('*', traceIdMiddleware)
  .use('*', requestLoggerMiddleware)
  .use('*', corsMiddleware)
  .use('*', bodyLimitMiddleware)
  .route('/api/v1', apiV1Router)
  .get('/api/health', (c) => ok(c, { status: 'ok', traceId: c.get('traceId') }));

// Desktop (Electron) shell only: serve the SPA bundle from the same origin so
// the renderer and API share a single port — no CORS negotiation required.
// The API routes above are registered first, so /api/v1/* and /api/health take
// precedence and are never shadowed by the static handler.
if (config.desktopStaticDir) {
  baseLogger.info(`[desktop] serving static files from ${config.desktopStaticDir}`);
  app.use('*', serveStatic({ root: config.desktopStaticDir }));
  // SPA fallback: any unmatched path serves index.html so React Router handles routing.
  app.use('*', serveStatic({ root: config.desktopStaticDir, rewriteRequestPath: () => '/index.html' }));
}

app.onError(errorHandler);
app.notFound((c) =>
  jsonErrorResponse(
    c,
    new VnextForgeError(
      ERROR_CODES.API_NOT_FOUND,
      'The requested route does not exist.',
      { source: 'app.notFound', layer: 'transport' },
      c.get('traceId'),
    ),
  ),
);

baseLogger.info(
  `vnext-forge-studio web-server running on http://${config.host}:${config.port} ` +
    `(corsAllowedOrigins=${config.corsAllowedOrigins.join(',') || '<none>'}, ` +
    `maxRequestBodyBytes=${config.maxRequestBodyBytes})`,
);

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host });

const lspBridge = composeLspBridge(loggerAdapter);
injectLspWebSocket(server, {
  bridge: lspBridge,
  logger: loggerAdapter,
  bindHost: config.host,
  corsAllowedOrigins: config.corsAllowedOrigins,
  lspMaxMessageBytes: config.lspMaxMessageBytes,
  lspMaxConnections: config.lspMaxConnections,
});

injectPtyWebSocket(server, {
  logger: loggerAdapter,
  bindHost: config.host,
  corsAllowedOrigins: config.corsAllowedOrigins,
  ptyMaxMessageBytes: config.ptyMaxMessageBytes,
  ptyMaxConnections: config.ptyMaxConnections,
});

export type AppType = typeof app;
export default app;
