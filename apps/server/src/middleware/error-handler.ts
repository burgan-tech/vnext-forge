import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import {
  ERROR_CODES,
  VnextForgeError,
  internalFailure,
} from '@vnext-studio/app-contracts'
import type { ErrorCode } from '@vnext-studio/app-contracts'

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
    case ERROR_CODES.RUNTIME_CONNECTION_FAILED:
    case ERROR_CODES.RUNTIME_TIMEOUT:
    case ERROR_CODES.RUNTIME_INVALID_RESPONSE:
      return 502
    default:
      return 500
  }
}

export function jsonErrorResponse(c: Context, error: VnextForgeError): Response {
  return c.json(error.toFailure(), statusFromErrorCode(error.code))
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

  if (error instanceof VnextForgeError) {
    console.error(error.toLogEntry())

    return jsonErrorResponse(c, error)
  }

  const traceId = c.get('traceId')
  console.error({
    code: ERROR_CODES.INTERNAL_UNEXPECTED,
    message: error instanceof Error ? error.message : 'Unknown error',
    traceId,
  })

  return c.json(internalFailure(traceId), 500)
}
