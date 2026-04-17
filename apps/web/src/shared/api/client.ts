import { isFailure, type ApiResponse } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';
import { sendToHost } from './vscodeTransport';

export interface ApiRequest {
  method: string;
  params?: unknown;
}

/**
 * Send a request to the extension host and return the raw ApiResponse<T>.
 * Use this when you need to inspect response.success yourself.
 *
 * @example
 * const res = await callApi<Project[]>({ method: 'projects.list' });
 * if (isFailure(res)) { ... }
 */
export async function callApi<T>(request: ApiRequest): Promise<ApiResponse<T>> {
  return sendToHost<T>(request.method, request.params ?? {});
}

/**
 * Send a request to the extension host and return the unwrapped data.
 * Throws VnextForgeError on failure.
 *
 * @example
 * const project = await unwrapApi<Project>({ method: 'projects.getById', params: { id } });
 */
export async function unwrapApi<T>(request: ApiRequest, fallbackMessage?: string): Promise<T> {
  const payload = await callApi<T>(request);

  if (isFailure(payload)) {
    throw toVnextError(payload, fallbackMessage);
  }

  return payload.data;
}
