import { hc } from 'hono/client';
import type { AppType } from '@vnext-forge/server';
import { isFailure, type ApiResponse } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/vnextError-helpers';

export const apiClient = hc<AppType>('/');
export type ApiClient = typeof apiClient;

/**
 * Converts a Hono RPC Response to ApiResponse<T>.
 * Use this as the async function passed to useAsync.
 *
 * @example
 * const { execute, data } = useAsync(() => callApi<Project[]>(apiClient.api.projects.$get()))
 */
export async function callApi<T>(response: Response | Promise<Response>): Promise<ApiResponse<T>> {
  try {
    const res = await response;
    return (await res.json()) as ApiResponse<T>;
  } catch (error) {
    throw toVnextError(error, 'API response could not be parsed.');
  }
}

/**
 * Converts a Hono RPC Response to T, throwing VnextForgeError on failure.
 * For use outside of useAsync where you need the unwrapped data directly.
 */
export async function unwrapApi<T>(
  response: Response | Promise<Response>,
  fallbackMessage?: string,
): Promise<T> {
  const payload = await callApi<T>(response);

  if (isFailure(payload)) {
    throw toVnextError(payload, fallbackMessage);
  }

  return payload.data;
}
