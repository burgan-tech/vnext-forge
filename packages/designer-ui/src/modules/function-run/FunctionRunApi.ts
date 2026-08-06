import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import type { FunctionScope, FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { callApi } from '../../api/client';

import type { FunctionExchange } from './types/functionRun.types';

export interface GetInfoParams {
  domain: string;
  functionKey: string;
  scope: FunctionScope;
  workflowKey?: string;
  instanceId?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function getInfo(params: GetInfoParams): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/getInfo', params });
}

export interface FetchContractParams {
  /** An href straight from `/info` — gateway-relative, prefix not guaranteed. */
  path: string;
  /**
   * The function's domain. The host uses it to strip whatever gateway prefix
   * `path` carries before rebasing onto the runtime's `/api/v1` root — see
   * `rebaseRuntimeHref`.
   */
  domain: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function fetchContract(
  params: FetchContractParams,
): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/fetchContract', params });
}

export interface InvokeParams {
  path: string;
  /** See `FetchContractParams.domain`. */
  domain: string;
  verb: FunctionVerb;
  body?: string;
  contentType?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function invoke(params: InvokeParams): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/invoke', params });
}
