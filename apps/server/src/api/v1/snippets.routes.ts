import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

/**
 * REST routes for the Snippets Library backend. Five operations: listAll,
 * getOne, save (create or update), delete, openLocation. All POST/json so
 * the body carries scope/projectId/data without query-string limits.
 */
export function registerSnippetsRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/snippets/listAll', (c) => helper(c, 'snippets/listAll', { source: 'json' }));
  app.post('/snippets/getOne', (c) => helper(c, 'snippets/getOne', { source: 'json' }));
  app.post('/snippets/save', (c) => helper(c, 'snippets/save', { source: 'json' }));
  app.post('/snippets/delete', (c) => helper(c, 'snippets/delete', { source: 'json' }));
  app.post('/snippets/openLocation', (c) =>
    helper(c, 'snippets/openLocation', { source: 'json' }),
  );
}
