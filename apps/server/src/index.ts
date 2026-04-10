import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts';
import { errorHandler, jsonErrorResponse } from '@shared/middleware/error-handler.js';
import { baseLogger } from '@shared/lib/logger.js';
import { requestLoggerMiddleware } from '@shared/middleware/logger.js';
import { traceIdMiddleware } from '@shared/middleware/trace-id.js';
import { ok } from '@shared/lib/response-helpers.js';
import { projectRouter } from '@project/router.js';
import { workspaceRouter } from '@workspace/router.js';
import { validateRouter } from '@validate/router.js';
import { runtimeProxyRouter } from '@runtime-proxy/router.js';
import { templateRouter } from '@template/router.js';
import '@shared/types/hono.js';

const app = new Hono()
  .use('*', traceIdMiddleware)
  .use('*', requestLoggerMiddleware)
  .use('*', cors())
  .route('/api/projects', projectRouter)
  .route('/api/files', workspaceRouter)
  .route('/api/validate', validateRouter)
  .route('/api/runtime', runtimeProxyRouter)
  .route('/api/templates', templateRouter)
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

const port = Number(process.env.PORT) || 3001;
baseLogger.info(`vnext-forge BFF running on port ${port}`);

serve({ fetch: app.fetch, port });

export type AppType = typeof app;
export default app;
