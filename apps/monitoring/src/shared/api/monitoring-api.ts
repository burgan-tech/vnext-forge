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
  const res = await client.get<T>(`/api/v1.0/monitor/${config.domain}${path}`, params);
  return unwrap(res);
}

/** Domain-prefixed POST. */
export async function domainPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await client.post<T>(`/api/v1.0/monitor/${config.domain}${path}`, body);
  return unwrap(res);
}

/** Workflow-scoped GET. path must start with '/' (e.g. '/instances'). */
export async function workflowGet<T>(workflow: string, path: string, params?: Record<string, string>): Promise<T> {
  const res = await client.get<T>(`/api/v1.0/monitor/${config.domain}/workflows/${workflow}${path}`, params);
  return unwrap(res);
}

/** Instance-scoped GET. path is the sub-resource (e.g. '/timeline'), empty string for the instance itself. */
export async function instanceGet<T>(workflow: string, instanceId: string, path = '', params?: Record<string, string>): Promise<T> {
  const res = await client.get<T>(`/api/v1.0/monitor/${config.domain}/workflows/${workflow}/instances/${instanceId}${path}`, params);
  return unwrap(res);
}
