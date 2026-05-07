import { ERROR_CODES, VnextForgeError, getMethodHttpSpec } from '@vnext-forge-studio/app-contracts';
import { dispatchMethod, type MethodRegistry, type ServiceRegistry } from '@vnext-forge-studio/services-core';
import type { Context } from 'hono';

import { config, isLoopbackHost } from '../../../shared/config/config.js';
import { created, ok } from '../../../shared/lib/response-helpers.js';
import type { Variables } from '../../../shared/types/hono.js';

export type ParamSource = 'query' | 'json';

export type DispatchHelper = (
  c: Context<{ Variables: Variables }>,
  methodId: string,
  opts: { source: ParamSource },
) => Promise<Response>;

export function createDispatchHelper(deps: {
  registry: MethodRegistry;
  services: ServiceRegistry;
}): DispatchHelper {
  const trusted = isLoopbackHost(config.host);

  return async (c, methodId, opts) => {
    const traceId = c.get('traceId');
    const origin = c.req.header('origin') ?? null;

    let rawParams: unknown;
    if (opts.source === 'query') {
      rawParams = c.req.query();
    } else {
      try {
        rawParams = await c.req.json();
      } catch {
        throw new VnextForgeError(
          ERROR_CODES.API_BAD_REQUEST,
          'Request body must be valid JSON.',
          { source: 'dispatch-helper', layer: 'transport' },
          traceId,
        );
      }
      rawParams ??= {};
    }

    const result = await dispatchMethod(
      deps.registry,
      deps.services,
      methodId,
      rawParams ?? {},
      {
        traceId,
        caller: {
          trusted,
          origin,
          allowedOrigins: config.corsAllowedOrigins,
        },
      },
    );

    const spec = getMethodHttpSpec(methodId);
    const successStatus = spec?.successStatus ?? 200;
    if (successStatus === 201) {
      return created(c, result);
    }
    return ok(c, result);
  };
}
