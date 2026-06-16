import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { ERROR_CODES } from '@vnext-forge-studio/app-contracts';

import { config } from '../config/config';
import {
  buildEnvelopeFailure,
  httpStatusToErrorCode,
  isApiResponseShape,
  mergeTraceIdFromResponseHeader,
} from './api-envelope';
import { createTraceInjectingFetch } from './trace-headers';

export interface MonitoringHttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface MonitoringHttpClient {
  get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
}

export function createMonitoringHttpClient(
  options: MonitoringHttpClientOptions = {},
): MonitoringHttpClient {
  const baseUrl = options.baseUrl ?? config.apiBaseUrl;
  const fetchWithTrace = createTraceInjectingFetch(fetch.bind(globalThis));
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string>,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    let url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url = `${url}?${qs}`;
    }

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetchWithTrace(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return buildEnvelopeFailure(
            ERROR_CODES.RUNTIME_TIMEOUT,
            `Request timed out after ${timeoutMs}ms (${method} ${path}).`,
          ) as ApiResponse<T>;
        }
        return buildEnvelopeFailure(
          ERROR_CODES.RUNTIME_CONNECTION_FAILED,
          `Network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        ) as ApiResponse<T>;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return buildEnvelopeFailure(
          httpStatusToErrorCode(response.status),
          `Non-JSON response (HTTP ${response.status}).`,
        ) as ApiResponse<T>;
      }

      if (isApiResponseShape(payload)) {
        return mergeTraceIdFromResponseHeader(response, payload) as ApiResponse<T>;
      }

      return buildEnvelopeFailure(
        httpStatusToErrorCode(response.status),
        `Unexpected response shape (HTTP ${response.status}).`,
      ) as ApiResponse<T>;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    get: (path, params) => request('GET', path, params),
    post: (path, body) => request('POST', path, undefined, body),
  };
}
