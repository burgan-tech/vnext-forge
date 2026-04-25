import {
  ERROR_CODES,
  type ApiResponse,
  type ErrorCode,
  type ResponseError,
} from '@vnext-forge/app-contracts';

export function isApiResponseShape(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.success === 'boolean' && 'data' in candidate && 'error' in candidate;
}

export function httpStatusToErrorCode(status: number): ErrorCode {
  if (status === 400) return ERROR_CODES.API_BAD_REQUEST;
  if (status === 401) return ERROR_CODES.API_UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.API_FORBIDDEN;
  if (status === 404) return ERROR_CODES.API_NOT_FOUND;
  if (status === 409) return ERROR_CODES.API_CONFLICT;
  if (status === 413) return ERROR_CODES.API_PAYLOAD_TOO_LARGE;
  if (status === 422) return ERROR_CODES.API_UNPROCESSABLE;
  if (status === 429) return ERROR_CODES.API_RATE_LIMITED;
  if (status === 502 || status === 503 || status === 504)
    return ERROR_CODES.RUNTIME_CONNECTION_FAILED;
  return ERROR_CODES.API_INTERNAL_ERROR;
}

export function buildEnvelopeFailure(
  code: ErrorCode,
  message: string,
  extra?: Pick<ResponseError, 'traceId'>,
): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(extra?.traceId ? { traceId: extra.traceId } : {}),
    },
  };
}

/** When the JSON body omits `error.traceId` but the server sent `X-Trace-Id`, copy it in. */
export function mergeTraceIdFromResponseHeader<T>(
  response: Response,
  payload: ApiResponse<T>,
): ApiResponse<T> {
  const headerTrace = response.headers.get('x-trace-id')?.trim();
  if (!headerTrace) return payload;
  if (payload.success) return payload;
  if (payload.error.traceId) return payload;
  return {
    ...payload,
    error: { ...payload.error, traceId: headerTrace },
  };
}
