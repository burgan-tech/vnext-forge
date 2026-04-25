import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerFilesRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.get('/files/read', (c) => helper(c, 'files/read', { source: 'query' }));
  app.put('/files/write', (c) => helper(c, 'files/write', { source: 'json' }));
  app.delete('/files/delete', (c) => helper(c, 'files/delete', { source: 'query' }));
  app.post('/files/mkdir', (c) => helper(c, 'files/mkdir', { source: 'json' }));
  app.post('/files/rename', (c) => helper(c, 'files/rename', { source: 'json' }));
  app.get('/files/browse', (c) => helper(c, 'files/browse', { source: 'query' }));
  app.get('/files/search', (c) => helper(c, 'files/search', { source: 'query' }));
}
