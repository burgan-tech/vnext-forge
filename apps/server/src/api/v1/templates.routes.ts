import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerTemplatesRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/templates/validateScriptStatus', (c) =>
    helper(c, 'templates/validateScriptStatus', { source: 'json' }),
  );
}
