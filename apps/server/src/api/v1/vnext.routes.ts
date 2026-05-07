import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerVnextRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.get('/vnext/components/list', (c) => helper(c, 'vnext/components/list', { source: 'query' }));
  app.get('/vnext/tasks/list', (c) => helper(c, 'vnext/tasks/list', { source: 'query' }));
  app.get('/vnext/workflows/list', (c) => helper(c, 'vnext/workflows/list', { source: 'query' }));
  app.get('/vnext/schemas/list', (c) => helper(c, 'vnext/schemas/list', { source: 'query' }));
  app.get('/vnext/views/list', (c) => helper(c, 'vnext/views/list', { source: 'query' }));
  app.get('/vnext/functions/list', (c) => helper(c, 'vnext/functions/list', { source: 'query' }));
  app.get('/vnext/extensions/list', (c) => helper(c, 'vnext/extensions/list', { source: 'query' }));
}
