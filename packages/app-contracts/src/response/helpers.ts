import { ERROR_CODES } from '../error/error-codes.js';
import type { ErrorCode } from '../error/error-codes.js';
import { VnextForgeError } from '../error/vnext-forge-error.js';
import type {
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  ResponseError,
  ResponseMeta,
} from './envelope.js';

export function success<T, M extends ResponseMeta = ResponseMeta>(
  data: T,
  meta?: M,
): ApiSuccess<T, M> {
  return {
    success: true,
    data,
    error: null,
    ...(meta ? { meta } : {}),
  };
}

export function failure(error: ResponseError): ApiFailure {
  return {
    success: false,
    data: null,
    error,
  };
}

export function failureFromCode(
  code: ErrorCode,
  message: string,
  traceId?: string,
): ApiFailure {
  return failure({
    code,
    message,
    ...(traceId ? { traceId } : {}),
  });
}

export function failureFromError(error: VnextForgeError): ApiFailure {
  return failure(error.toUserMessage());
}

export function internalFailure(traceId?: string): ApiFailure {
  return failureFromCode(
    ERROR_CODES.INTERNAL_UNEXPECTED,
    'An unexpected error occurred.',
    traceId,
  );
}

export function isSuccess<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): response is ApiSuccess<T, M> {
  return response.success === true;
}

export function isFailure<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): response is ApiFailure {
  return response.success === false;
}

export function getData<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): T | null {
  return isSuccess(response) ? response.data : null;
}

export function getError<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): ApiFailure['error'] | null {
  return isFailure(response) ? response.error : null;
}

export function getMeta<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): M | undefined {
  return isSuccess(response) ? response.meta : undefined;
}

export function unwrap<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): T {
  if (isSuccess(response)) return response.data;
  throw new Error(response.error.message);
}

export function unwrapOr<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  fallback: T,
): T {
  return isSuccess(response) ? response.data : fallback;
}

export function mapResponse<T, U, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  fn: (data: T) => U,
): ApiResponse<U, M> {
  if (isSuccess(response)) {
    return { ...response, data: fn(response.data) };
  }

  return response;
}

export function fold<T, U, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  onSuccess: (data: T, meta: M | undefined) => U,
  onFailure: (error: ApiFailure['error']) => U,
): U {
  if (isSuccess(response)) return onSuccess(response.data, response.meta);
  return onFailure(response.error);
}
