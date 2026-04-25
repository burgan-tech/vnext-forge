import type { ApiResponse } from '@vnext-forge/app-contracts';

import { callApi } from '@shared/api';

import { v1 } from './v1';

export async function validateScriptStatus(
  params: unknown,
): Promise<ApiResponse<unknown>> {
  return callApi(v1.templates.validateScriptStatus.$post({ json: params }));
}
