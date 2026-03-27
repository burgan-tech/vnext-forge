import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectRoutes } from './routes/projects.js'
import { fileRoutes } from './routes/files.js'
import { runtimeProxyRoutes } from './routes/runtime-proxy.js'
import { validateRoutes } from './routes/validate.js'
import { templateRoutes } from './routes/templates.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.route('/api/projects', projectRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/runtime', runtimeProxyRoutes)
app.route('/api/validate', validateRoutes)
app.route('/api/templates', templateRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

const port = Number(process.env.PORT) || 3001
console.log(`vnext-flow-studio BFF running on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
