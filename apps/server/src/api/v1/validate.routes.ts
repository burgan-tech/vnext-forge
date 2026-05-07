import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerValidateRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/validate/workflow', (c) => helper(c, 'validate/workflow', { source: 'json' }));
  app.post('/validate/component', (c) => helper(c, 'validate/component', { source: 'json' }));
  app.get('/validate/getAvailableTypes', (c) =>
    helper(c, 'validate/getAvailableTypes', { source: 'query' }),
  );
  app.get('/validate/getAllSchemas', (c) => helper(c, 'validate/getAllSchemas', { source: 'query' }));
  app.get('/validate/getSchema', (c) => helper(c, 'validate/getSchema', { source: 'query' }));
}
