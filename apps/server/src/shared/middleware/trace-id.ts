import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

/**
 * W3C `traceparent` (00-traceid-spanid-flags). Parsed only as a *link* hint:
 * the 32-hex trace id is stored as `linkedTraceId`; the server's own
 * `traceId` is always a freshly generated UUID (R-b11 / trace-v1).
 */
const TRACEPARENT_RE =
  /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i

function parseLinkedTraceIdFromTraceparent(header: string | undefined): string | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  const match = TRACEPARENT_RE.exec(trimmed)
  return match?.[1]?.toLowerCase()
}

export const traceIdMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = randomUUID()
  const linkedTraceId = parseLinkedTraceIdFromTraceparent(c.req.header('traceparent'))
  c.set('traceId', traceId)
  if (linkedTraceId) {
    c.set('linkedTraceId', linkedTraceId)
  }
  try {
    await next()
  } finally {
    c.header('X-Trace-Id', traceId)
  }
}
