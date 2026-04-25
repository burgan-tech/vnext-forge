import { ERROR_CODES, getMethodHttpSpec, type ApiResponse } from '@vnext-forge/app-contracts';
import type { ApiTransport } from '@vnext-forge/designer-ui';

import {
  buildEnvelopeFailure,
  httpStatusToErrorCode,
  isApiResponseShape,
  mergeTraceIdFromResponseHeader,
} from '@shared/api/api-envelope';
import { createTraceInjectingFetch } from '@shared/api/trace-headers';

export interface HttpTransportOptions {
  /**
   * Base URL of the Hono API server. Requests go to `${baseUrl}/api/v1/<method>`.
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

function serializeQueryParams(params: unknown): string {
  if (params === null || params === undefined) return '';
  if (typeof params !== 'object' || Array.isArray(params)) return '';
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      q.set(key, String(value));
    }
  }
  return q.toString();
}

/**
 * Standalone web SPA transport. Dispatches each `ApiTransport.send()` call to
 * `${baseUrl}/api/v1/<method>` using `METHOD_HTTP_METADATA` (verb, query vs JSON).
 *
 * Non-2xx responses, malformed JSON, network errors and timeouts are mapped
 * to typed `ApiFailure` envelopes with stable `ErrorCode`s so downstream
 * consumers (notification mapper, useAsync, etc.) never need to string-match.
 */
export function createHttpTransport(options: HttpTransportOptions = {}): ApiTransport {
  const baseUrl = options.baseUrl ?? '';
  const baseFetch = options.fetchImpl ?? fetch.bind(globalThis);
  const fetchWithTrace = createTraceInjectingFetch(baseFetch);
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    async send<T>(method: string, params: unknown): Promise<ApiResponse<T>> {
      const spec = getMethodHttpSpec(method);
      if (!spec) {
        return buildEnvelopeFailure(
          ERROR_CODES.API_NOT_FOUND,
          `Unknown method: ${method}`,
        ) as ApiResponse<T>;
      }

      let url = `${baseUrl}/api/v1/${method}`;
      const headers: Record<string, string> = {};
      let body: string | undefined;

      if (spec.paramSource === 'query') {
        const qs = serializeQueryParams(params);
        if (qs) url = `${url}?${qs}`;
      } else {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(params ?? {});
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let response: Response;
        try {
          response = await fetchWithTrace(url, {
            method: spec.verb,
            headers,
            body,
            signal: controller.signal,
          });
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            return buildEnvelopeFailure(
              ERROR_CODES.RUNTIME_TIMEOUT,
              `Request timed out after ${timeoutMs}ms (${method}).`,
            ) as ApiResponse<T>;
          }
          return buildEnvelopeFailure(
            ERROR_CODES.RUNTIME_CONNECTION_FAILED,
            `Network error contacting ${url}: ${cause instanceof Error ? cause.message : String(cause)}`,
          ) as ApiResponse<T>;
        }

        const headerTraceId = response.headers.get('x-trace-id')?.trim();

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return buildEnvelopeFailure(
            httpStatusToErrorCode(response.status),
            `API returned non-JSON body (HTTP ${response.status}).`,
            headerTraceId ? { traceId: headerTraceId } : undefined,
          ) as ApiResponse<T>;
        }

        if (isApiResponseShape(payload)) {
          return mergeTraceIdFromResponseHeader(
            response,
            payload,
          ) as ApiResponse<T>;
        }

        return buildEnvelopeFailure(
          httpStatusToErrorCode(response.status),
          `API returned an unexpected response shape (HTTP ${response.status}).`,
          headerTraceId ? { traceId: headerTraceId } : undefined,
        ) as ApiResponse<T>;
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}
