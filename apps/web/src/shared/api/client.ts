import { hc } from 'hono/client';
import type { AppType } from '@vnext-forge-studio/server';
import { isFailure, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';
import { config } from '@shared/config/config';
import {
  buildEnvelopeFailure,
  httpStatusToErrorCode,
  isApiResponseShape,
  mergeTraceIdFromResponseHeader,
} from '@shared/api/api-envelope';
import { createTraceInjectingFetch } from '@shared/api/trace-headers';

const traceInjectingFetch = createTraceInjectingFetch(fetch.bind(globalThis));

export const apiClient = hc<AppType>(config.apiBaseUrl || '/', {
  fetch: traceInjectingFetch,
});
export type ApiClient = typeof apiClient;

export async function callApi<T>(response: Response | Promise<Response>): Promise<ApiResponse<T>> {
  try {
    const res = await response;
    const headerTraceId = res.headers.get('x-trace-id')?.trim();

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return buildEnvelopeFailure(
        httpStatusToErrorCode(res.status),
        `API returned non-JSON body (HTTP ${res.status}).`,
        headerTraceId ? { traceId: headerTraceId } : undefined,
      ) as ApiResponse<T>;
    }

    if (!isApiResponseShape(payload)) {
      return buildEnvelopeFailure(
        httpStatusToErrorCode(res.status),
        `API returned an unexpected response shape (HTTP ${res.status}).`,
        headerTraceId ? { traceId: headerTraceId } : undefined,
      ) as ApiResponse<T>;
    }

    return mergeTraceIdFromResponseHeader(res, payload) as ApiResponse<T>;
  } catch (error) {
    throw toVnextError(error, 'API response could not be parsed.');
  }
}

export async function unwrapApi<T>(
  response: Response | Promise<Response>,
  fallbackMessage?: string,
): Promise<T> {
  const payload = await callApi<T>(response);
  if (isFailure(payload)) throw toVnextError(payload, fallbackMessage);
  return payload.data;
}
