import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { config } from '../config/config';
import { createMonitoringHttpClient } from './api-client';

const client = createMonitoringHttpClient();

/** Throws on ApiFailure, returns data on success. */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error.message);
  return res.data;
}

/** Domain-prefixed GET. Path must start with '/' and NOT include the domain segment. */
export async function domainGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await client.get<T>(`/api/v1/${config.domain}${path}`, params);
  return unwrap(res);
}

/** Domain-prefixed POST. */
export async function domainPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await client.post<T>(`/api/v1/${config.domain}${path}`, body);
  return unwrap(res);
}
