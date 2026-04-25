import { ZodError, type ZodTypeAny, type infer as zInfer } from 'zod'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'

import type { MethodHandler, MethodRegistry, ServiceRegistry } from './method-registry.js'
import { assertCapabilityAllowed, type CallerContext } from './policy.js'

export interface DispatchOptions {
  traceId?: string
  /**
   * Caller identity / trust context, supplied by the host transport. When
   * present, the dispatcher enforces the per-method capability policy
   * defined in `policy.ts`. Omit only in legacy in-process tests.
   */
  caller?: CallerContext
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

  // Capability gate runs BEFORE param parsing so a non-allow-listed caller
  // cannot probe the schema of a privileged method by sending bad input.
  assertCapabilityAllowed(method, options.caller, options.traceId)

  let parsedParams: zInfer<typeof entry.paramsSchema>
  try {
    parsedParams = entry.paramsSchema.parse(rawParams) as zInfer<typeof entry.paramsSchema>
  } catch (error) {
    if (error instanceof ZodError) {
      // Strip any value-bearing fields from Zod issues so we never leak
      // a raw param payload (which could contain secrets) into log sinks
      // or HTTP error envelopes. Keep only the structural information the
      // caller needs to fix their request.
      const safeIssues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }))
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Request validation failed',
        {
          source: 'services-core.dispatchMethod',
          layer: 'application',
          details: { method, issues: safeIssues },
        },
        options.traceId,
      )
    }
    throw error
  }

  return entry.handler(parsedParams, services, options.traceId)
}
