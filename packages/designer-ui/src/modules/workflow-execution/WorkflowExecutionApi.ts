import {
  ERROR_CODES,
  failureFromCode,
  success,
  type ApiResponse,
} from '@vnext-forge-studio/app-contracts';
import { z } from 'zod';

import { callApi } from '../../api/client';
import { parseRuntimeHealthResponse } from './WorkflowExecutionSchema';

export interface RuntimeHealthSnapshot {
  connected: boolean;
  healthStatus: 'healthy' | 'unhealthy';
  lastHealthCheck: string;
}

export async function checkRuntimeHealth(): Promise<ApiResponse<RuntimeHealthSnapshot>> {
  const response = await callApi<unknown>({ method: 'health/check' });

  if (!response.success) {
    return response;
  }

  let parsed;
  try {
    parsed = parseRuntimeHealthResponse(response.data);
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

  // The server reports an unreachable runtime as `status: 'down'` over the
  // success channel so that "runtime not running" is treated as an expected
  // operational state instead of a transport error. We surface it here as an
  // unhealthy snapshot — UI consumers display a "disconnected" indicator
  // without logging warnings on every poll.
  const isHealthy = parsed.status === 'ok';
  return success({
    connected: isHealthy,
    healthStatus: isHealthy ? 'healthy' : 'unhealthy',
    lastHealthCheck: new Date().toISOString(),
  });
}
