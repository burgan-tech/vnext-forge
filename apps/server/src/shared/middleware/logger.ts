import type { MiddlewareHandler } from 'hono'
import { baseLogger } from '@shared/lib/logger.js'

export const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  const startedAt = performance.now()
  const traceId = c.get('traceId')
  const logger = baseLogger.child({
    traceId,
    method: c.req.method,
    path: c.req.path,
  })

  c.set('logger', logger)

  let didThrow = false

  try {
    await next()
  } catch (error) {
    didThrow = true
    throw error
  } finally {
    if (!didThrow) {
      const durationMs = Number((performance.now() - startedAt).toFixed(2))
      const contentLengthHeader = c.res.headers.get('content-length')
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined

      logger.info(
        {
          status: c.res.status,
          durationMs,
          ...(Number.isFinite(contentLength) ? { contentLength } : {}),
        },
        'request completed',
      )
    }
  }
}
