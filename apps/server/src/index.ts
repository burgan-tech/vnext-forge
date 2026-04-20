import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts';

import { createPinoLoggerAdapter } from './adapters/pino-logger.js';
import { composeLspBridge } from './composition/lsp.js';
import { composeWebServerServices } from './composition/services.js';
import { injectLspWebSocket } from './lsp/router.js';
import { createRpcRouter } from './rpc/rpc-router.js';
import { config } from './shared/config/config.js';
import { baseLogger } from './shared/lib/logger.js';
import { ok } from './shared/lib/response-helpers.js';
import { errorHandler, jsonErrorResponse } from './shared/middleware/error-handler.js';
import { requestLoggerMiddleware } from './shared/middleware/logger.js';
import { traceIdMiddleware } from './shared/middleware/trace-id.js';
import type { Variables } from './shared/types/hono.js';

const loggerAdapter = createPinoLoggerAdapter(baseLogger);
const { services, registry } = composeWebServerServices(loggerAdapter);
const rpcRouter = createRpcRouter({ registry, services });

const app = new Hono<{ Variables: Variables }>()
  .use('*', traceIdMiddleware)
  .use('*', requestLoggerMiddleware)
  .use('*', cors())
  .route('/api/rpc', rpcRouter)
  .get('/api/health', (c) => ok(c, { status: 'ok', traceId: c.get('traceId') }));

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

baseLogger.info(`vnext-forge web-server running on port ${config.port}`);

const server = serve({ fetch: app.fetch, port: config.port });

const lspBridge = composeLspBridge(loggerAdapter);
injectLspWebSocket(server, { bridge: lspBridge, logger: loggerAdapter });

export type AppType = typeof app;
export default app;
