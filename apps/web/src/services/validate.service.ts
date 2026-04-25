import type { ApiResponse } from '@vnext-forge/app-contracts';

import { callApi } from '@shared/api';

import { v1 } from './v1';

export async function workflow(
  params: unknown,
): Promise<ApiResponse<unknown>> {
  return callApi(v1.validate.workflow.$post({ json: params }));
}

export async function component(params: unknown): Promise<ApiResponse<unknown>> {
  return callApi(v1.validate.component.$post({ json: params }));
}

export async function getAvailableTypes(
  params?: Record<string, string>,
): Promise<ApiResponse<unknown>> {
  return callApi(
    v1.validate.getAvailableTypes.$get(
      params && Object.keys(params).length > 0 ? { query: params } : undefined,
    ),
  );
}

export async function getAllSchemas(
  params?: Record<string, string>,
): Promise<ApiResponse<unknown>> {
  return callApi(
    v1.validate.getAllSchemas.$get(
      params && Object.keys(params).length > 0 ? { query: params } : undefined,
    ),
  );
}

export async function getSchema(params: {
  id: string;
  version?: string;
}): Promise<ApiResponse<unknown>> {
  const query: Record<string, string> = { id: params.id };
  if (params.version !== undefined) query.version = params.version;
  return callApi(v1.validate.getSchema.$get({ query }));
}
