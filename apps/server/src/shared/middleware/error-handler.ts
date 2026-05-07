import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import {
  ERROR_CODES,
  type ErrorCode,
  VnextForgeError,
  internalFailure,
} from '@vnext-forge-studio/app-contracts'
import { baseLogger } from '../lib/logger.js'

function statusFromErrorCode(code: ErrorCode): ContentfulStatusCode {
  switch (code) {
    case ERROR_CODES.FILE_NOT_FOUND:
    case ERROR_CODES.PROJECT_NOT_FOUND:
    case ERROR_CODES.API_NOT_FOUND:
      return 404
    case ERROR_CODES.FILE_INVALID_PATH:
    case ERROR_CODES.API_BAD_REQUEST:
      return 400
    case ERROR_CODES.FILE_PERMISSION_DENIED:
    case ERROR_CODES.API_FORBIDDEN:
      return 403
    case ERROR_CODES.API_UNAUTHORIZED:
      return 401
    case ERROR_CODES.API_CONFLICT:
    case ERROR_CODES.PROJECT_ALREADY_EXISTS:
      return 409
    case ERROR_CODES.API_UNPROCESSABLE:
      return 422
    case ERROR_CODES.API_PAYLOAD_TOO_LARGE:
      return 413
    case ERROR_CODES.API_RATE_LIMITED:
      return 429
    case ERROR_CODES.RUNTIME_CONNECTION_FAILED:
    case ERROR_CODES.RUNTIME_TIMEOUT:
    case ERROR_CODES.RUNTIME_INVALID_RESPONSE:
      return 502
    default:
      return 500
  }
}

/**
 * Render a `VnextForgeError` as the standard `ApiResponse` failure envelope.
 *
 * The error originally constructed inside a service may not carry a
 * `traceId` (it is not always known at throw time). The error-handler is
 * the single boundary that owns the request → response correlation, so we
 * fold the request's `traceId` into the user-facing payload here. This
 * guarantees the contract HttpTransport relies on: every failure body
 * carries the same `traceId` the response advertises in `X-Trace-Id`.
 */
export function jsonErrorResponse(c: Context, error: VnextForgeError): Response {
  const traceId = error.traceId ?? c.get('traceId')
  const failure = error.toFailure()
  if (traceId && !failure.error.traceId) {
    failure.error.traceId = traceId
  }
  return c.json(failure, statusFromErrorCode(error.code))
}

export const errorHandler = (error: Error, c: Context) => {
  if (error instanceof ZodError) {
    return jsonErrorResponse(
      c,
      new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Request validation failed.',
        {
          source: 'errorHandler.zod',
          layer: 'transport',
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          },
        },
        c.get('traceId'),
      ),
    )
  }

  const traceId = c.get('traceId')
  let logger = baseLogger.child({ traceId, source: 'errorHandler' })

  try {
    logger = c.get('logger').child({ source: 'errorHandler' })
  } catch {
    // Request logger may not be initialized for early pipeline failures.
  }

  if (error instanceof VnextForgeError) {
    logger.error(error.toLogEntry(), 'request failed')
    return jsonErrorResponse(c, error)
  }

  logger.error(
    {
      err: error,
      code: ERROR_CODES.INTERNAL_UNEXPECTED,
      traceId,
      source: 'errorHandler',
    },
    'unexpected error',
  )

  return c.json(internalFailure(traceId), 500)
}
