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
  path: string;
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
