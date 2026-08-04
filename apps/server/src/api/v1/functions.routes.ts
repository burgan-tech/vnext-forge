import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerFunctionsRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/functions/getInfo', (c) => helper(c, 'functions/getInfo', { source: 'json' }));
  app.post('/functions/fetchContract', (c) => helper(c, 'functions/fetchContract', { source: 'json' }));
  app.post('/functions/invoke', (c) => helper(c, 'functions/invoke', { source: 'json' }));
}
