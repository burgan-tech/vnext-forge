import {
  ERROR_CODES,
  failureFromCode,
  success,
  type ApiResponse,
} from '@vnext-forge/app-contracts';
import { z } from 'zod';

import { callApi } from '../../api/client';
import { parseRuntimeHealthResponse } from './WorkflowExecutionSchema';

export interface RuntimeHealthSnapshot {
  connected: boolean;
  healthStatus: 'healthy' | 'unhealthy';
  lastHealthCheck: string;
}

export async function checkRuntimeHealth(): Promise<ApiResponse<RuntimeHealthSnapshot>> {
  const response = await callApi<unknown>({ method: 'health.check' });

  if (!response.success) {
    return response;
  }

  try {
    parseRuntimeHealthResponse(response.data);
  } catch (error) {
    const traceId =
      response.data && typeof response.data === 'object' && 'traceId' in response.data
        ? ((response.data as { traceId?: unknown }).traceId ?? undefined)
        : undefined;

    if (error instanceof z.ZodError) {
      return failureFromCode(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Runtime health could not be verified.',
        typeof traceId === 'string' ? traceId : undefined,
      );
    }

    return failureFromCode(
      ERROR_CODES.RUNTIME_INVALID_RESPONSE,
      'Runtime health could not be verified.',
      typeof traceId === 'string' ? traceId : undefined,
    );
  }

  return success({
    connected: true,
    healthStatus: 'healthy',
    lastHealthCheck: new Date().toISOString(),
  });
}
