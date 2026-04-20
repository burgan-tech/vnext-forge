import { Hono } from 'hono';
import { z } from 'zod';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts';
import { dispatchMethod, type MethodRegistry, type ServiceRegistry } from '@vnext-forge/services-core';

import { config, isLoopbackHost } from '../shared/config/config.js';
import type { Variables } from '../shared/types/hono.js';
import { ok } from '../shared/lib/response-helpers.js';

const rpcRequestSchema = z.object({
  method: z.string().min(1),
  params: z.unknown().optional(),
});

/**
 * Single-endpoint Hono router that fronts the shared `services-core`
 * `methodRegistry`. Each `POST /api/rpc` body is `{ method, params }`; the
 * dispatcher validates `params` against the registered zod schema and routes
 * the call to the corresponding service. Failures bubble up as
 * `VnextForgeError` and are formatted by the global error-handler middleware
 * exactly like the legacy slice routes did.
 */
export function createRpcRouter(deps: {
  registry: MethodRegistry;
  services: ServiceRegistry;
}) {
  const router = new Hono<{ Variables: Variables }>();

  // Loopback binds run in single-developer trust mode: the operator owns
  // the machine and any TCP client able to reach 127.0.0.1 already has
  // file-system level access. For non-loopback binds we MUST require an
  // allow-listed Origin for privileged methods.
  const trusted = isLoopbackHost(config.host);

  router.post('/', async (c) => {
    const traceId = c.get('traceId');
    const origin = c.req.header('origin') ?? null;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'RPC request body must be valid JSON.',
        { source: 'rpc-router', layer: 'transport' },
        traceId,
      );
    }

    const parsed = rpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'RPC request must be { method, params }.',
        {
          source: 'rpc-router',
          layer: 'transport',
          details: { issues: parsed.error.issues },
        },
        traceId,
      );
    }

    const result = await dispatchMethod(
      deps.registry,
      deps.services,
      parsed.data.method,
      parsed.data.params ?? {},
      {
        traceId,
        caller: {
          trusted,
          origin,
          allowedOrigins: config.corsAllowedOrigins,
        },
      },
    );

    return ok(c, result);
  });

  return router;
}
