import type { ApiResponse, ApiSuccess, ApiFailure, ResponseMeta } from './envelope.js';

// ── Type Guards ──────────────────────────────────────────────────────────────

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

// ── Data Accessors ───────────────────────────────────────────────────────────

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

// ── Unwrap / Fold ────────────────────────────────────────────────────────────

/**
 * Unwraps the data from a successful response.
 * Throws if the response is a failure.
 *
 * @example
 * const users = unwrap(await fetchUsers());
 */
export function unwrap<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
): T {
  if (isSuccess(response)) return response.data;
  throw new Error(response.error.message);
}

/**
 * Returns `data` on success or a fallback value on failure.
 *
 * @example
 * const users = unwrapOr(await fetchUsers(), []);
 */
export function unwrapOr<T, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  fallback: T,
): T {
  return isSuccess(response) ? response.data : fallback;
}

/**
 * Maps over a successful response, leaving failures untouched.
 *
 * @example
 * const names = mapResponse(await fetchUsers(), (users) => users.map(u => u.name));
 */
export function mapResponse<T, U, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  fn: (data: T) => U,
): ApiResponse<U, M> {
  if (isSuccess(response)) {
    return { ...response, data: fn(response.data) };
  }
  return response;
}

/**
 * Executes `onSuccess` or `onFailure` based on the response variant.
 *
 * @example
 * fold(
 *   response,
 *   (data) => setUsers(data),
 *   (error) => toast.error(error.message),
 * );
 */
export function fold<T, U, M extends ResponseMeta = ResponseMeta>(
  response: ApiResponse<T, M>,
  onSuccess: (data: T, meta: M | undefined) => U,
  onFailure: (error: ApiFailure['error']) => U,
): U {
  if (isSuccess(response)) return onSuccess(response.data, response.meta);
  return onFailure(response.error);
}
