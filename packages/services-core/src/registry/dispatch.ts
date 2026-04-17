import { ZodError, type ZodTypeAny, type infer as zInfer } from 'zod'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'

import type { MethodHandler, MethodRegistry, ServiceRegistry } from './method-registry.js'

export interface DispatchOptions {
  traceId?: string
}

/**
 * Generic dispatcher used by every shell. Each transport (Hono RPC, VS Code
 * `MessageRouter`, in-process tests) calls into this single function instead
 * of re-implementing the same registry-lookup + zod-parse + handler-invoke
 * sequence.
 *
 * Validation failures are translated into a `VnextForgeError` with the
 * `*_VALIDATION_FAILED` code so the standard error-handler middleware can
 * shape the response envelope.
 */
export async function dispatchMethod(
  registry: MethodRegistry,
  services: ServiceRegistry,
  method: string,
  rawParams: unknown,
  options: DispatchOptions = {},
): Promise<unknown> {
  const entry = registry[method] as MethodHandler<ZodTypeAny, ZodTypeAny> | undefined
  if (!entry) {
    throw new VnextForgeError(
      ERROR_CODES.API_NOT_FOUND,
      `Unknown method: ${method}`,
      { source: 'services-core.dispatchMethod', layer: 'application', details: { method } },
      options.traceId,
    )
  }

  let parsedParams: zInfer<typeof entry.paramsSchema>
  try {
    parsedParams = entry.paramsSchema.parse(rawParams) as zInfer<typeof entry.paramsSchema>
  } catch (error) {
    if (error instanceof ZodError) {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Request validation failed',
        {
          source: 'services-core.dispatchMethod',
          layer: 'application',
          details: { method, issues: error.issues },
        },
        options.traceId,
      )
    }
    throw error
  }

  return entry.handler(parsedParams, services, options.traceId)
}
