import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerCliRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/cli/check', (c) => helper(c, 'cli/check', { source: 'json' }));
  app.post('/cli/checkUpdate', (c) => helper(c, 'cli/checkUpdate', { source: 'json' }));
  app.post('/cli/domainAdd', (c) => helper(c, 'cli/domainAdd', { source: 'json' }));
  app.post('/cli/execute', (c) => helper(c, 'cli/execute', { source: 'json' }));
  app.post('/cli/updateGlobal', (c) => helper(c, 'cli/updateGlobal', { source: 'json' }));
}
