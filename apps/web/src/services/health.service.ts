import type { ApiResponse } from '@vnext-forge/app-contracts';

import { callApi } from '@shared/api';

import { v1 } from './v1';

export async function check(
  params?: Record<string, string>,
): Promise<ApiResponse<unknown>> {
  return callApi(
    v1.health.check.$get(
      params && Object.keys(params).length > 0 ? { query: params } : undefined,
    ),
  );
}
