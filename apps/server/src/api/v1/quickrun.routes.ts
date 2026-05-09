import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerQuickrunRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/quickrun/startInstance', (c) => helper(c, 'quickrun/startInstance', { source: 'json' }));
  app.post('/quickrun/fireTransition', (c) => helper(c, 'quickrun/fireTransition', { source: 'json' }));
  app.post('/quickrun/getState', (c) => helper(c, 'quickrun/getState', { source: 'json' }));
  app.post('/quickrun/getView', (c) => helper(c, 'quickrun/getView', { source: 'json' }));
  app.post('/quickrun/getData', (c) => helper(c, 'quickrun/getData', { source: 'json' }));
  app.post('/quickrun/getSchema', (c) => helper(c, 'quickrun/getSchema', { source: 'json' }));
  app.post('/quickrun/getHistory', (c) => helper(c, 'quickrun/getHistory', { source: 'json' }));
  app.post('/quickrun/retryInstance', (c) => helper(c, 'quickrun/retryInstance', { source: 'json' }));
  app.post('/quickrun/listInstances', (c) => helper(c, 'quickrun/listInstances', { source: 'json' }));
  app.post('/quickrun/getInstance', (c) => helper(c, 'quickrun/getInstance', { source: 'json' }));
}
