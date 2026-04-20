import {
  ERROR_CODES,
  type ApiResponse,
  type ErrorCode,
  type ResponseError,
} from '@vnext-forge/app-contracts';
import type { ApiTransport } from '@vnext-forge/designer-ui';

export interface HttpTransportOptions {
  /**
   * Base URL of the Hono RPC server. The transport POSTs to
   * `${baseUrl}/api/rpc` with `{ method, params }`.
   */
  baseUrl?: string;
  /**
   * Optional override for the default `fetch` implementation. Useful for
   * tests, server-side rendering, and custom auth wrappers.
   */
  fetchImpl?: typeof fetch;
  /**
   * Per-request timeout in milliseconds. Defaults to 30s.
   */
  timeoutMs?: number;
}

/**
 * Build a typed `ApiFailure` envelope for transport-level failures (network
 * errors, non-2xx responses where the body is not a valid JSON envelope,
 * timeouts). Domain failures coming back as a well-formed `ApiResponse` from
 * the server are returned as-is by `send`.
 */
function buildTransportFailure(
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

function statusToErrorCode(status: number): ErrorCode {
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

function isApiResponseShape(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.success === 'boolean' && 'data' in candidate && 'error' in candidate;
}

/**
 * Standalone web SPA transport. Sends each `ApiTransport.send()` call as a
 * single POST to the RPC endpoint of the colocated Hono web-server, which
 * dispatches the call against the shared services-core method registry.
 *
 * Non-2xx responses, malformed JSON, network errors and timeouts are mapped
 * to typed `ApiFailure` envelopes with stable `ErrorCode`s so downstream
 * consumers (notification mapper, useAsync, etc.) never need to string-match.
 */
export function createHttpTransport(options: HttpTransportOptions = {}): ApiTransport {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    async send<T>(method: string, params: unknown): Promise<ApiResponse<T>> {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let response: Response;
        try {
          response = await fetchImpl(`${baseUrl}/api/rpc`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ method, params: params ?? {} }),
            signal: controller.signal,
          });
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            return buildTransportFailure(
              ERROR_CODES.RUNTIME_TIMEOUT,
              `Request timed out after ${timeoutMs}ms (${method}).`,
            ) as ApiResponse<T>;
          }
          return buildTransportFailure(
            ERROR_CODES.RUNTIME_CONNECTION_FAILED,
            `Network error contacting ${baseUrl || '<same-origin>'}/api/rpc: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          ) as ApiResponse<T>;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return buildTransportFailure(
            statusToErrorCode(response.status),
            `RPC endpoint returned non-JSON body (HTTP ${response.status}).`,
          ) as ApiResponse<T>;
        }

        // The server's error-handler always returns an `ApiResponse` envelope,
        // even for 4xx/5xx. Trust it when the shape matches; otherwise wrap.
        if (isApiResponseShape(payload)) {
          return payload as ApiResponse<T>;
        }

        return buildTransportFailure(
          statusToErrorCode(response.status),
          `RPC endpoint returned an unexpected response shape (HTTP ${response.status}).`,
        ) as ApiResponse<T>;
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}
