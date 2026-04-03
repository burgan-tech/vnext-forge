import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { baseController } from '@controllers/base/index.js'
import { errorHandler, jsonErrorResponse } from '@middleware/error-handler.js'
import { traceIdMiddleware } from '@middleware/trace-id.js'
import { fileRoutes } from '@routes/files.js'
import { projectRoutes } from '@routes/projects.js'
import { runtimeProxyRoutes } from '@routes/runtime-proxy.js'
import { templateRoutes } from '@routes/templates.js'
import { validateRoutes } from '@routes/validate.js'
import '@server-types/hono.js'

const app = new Hono()

app.use('*', traceIdMiddleware)
app.use('*', logger())
app.use('*', cors())

app.route('/api/projects', projectRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/runtime', runtimeProxyRoutes)
app.route('/api/validate', validateRoutes)
app.route('/api/templates', templateRoutes)

app.get('/api/health', (c) =>
  baseController.ok(c, { status: 'ok', traceId: c.get('traceId') }),
)

app.onError(errorHandler)
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
)

const port = Number(process.env.PORT) || 3001
console.log(`vnext-forge BFF running on port ${port}`)

serve({ fetch: app.fetch, port })

export type AppType = typeof app
export default app
