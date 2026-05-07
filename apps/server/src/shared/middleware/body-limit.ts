import type { MiddlewareHandler } from 'hono'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { config } from '../config/config.js'

/**
 * Reject any request whose declared `Content-Length` exceeds the configured
 * limit BEFORE the body is read. This is a defence-in-depth control: it
 * caps the worst-case JSON parser allocation independent of any per-handler
 * input validation.
 *
 * `Content-Length: 0`, missing header (e.g. `GET`), and chunked transfers
 * (no length advertised) are allowed through; the JSON parser still bounds
 * those with its own per-read budget but a future iteration could stream
 * with a hard byte counter.
 */
export const bodyLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const limit = config.maxRequestBodyBytes
  const header = c.req.header('content-length')
  if (header) {
    const declared = Number.parseInt(header, 10)
    if (Number.isFinite(declared) && declared > limit) {
      throw new VnextForgeError(
        ERROR_CODES.API_PAYLOAD_TOO_LARGE,
        `Request body of ${declared} bytes exceeds the ${limit}-byte limit.`,
        {
          source: 'bodyLimitMiddleware',
          layer: 'transport',
          details: { declaredBytes: declared, limitBytes: limit },
        },
        c.get('traceId'),
      )
    }
  }
  await next()
}
