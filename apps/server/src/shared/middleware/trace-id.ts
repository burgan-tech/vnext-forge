import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export const traceIdMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = randomUUID()
  c.set('traceId', traceId)
  c.header('X-Trace-Id', traceId)
  await next()
}
