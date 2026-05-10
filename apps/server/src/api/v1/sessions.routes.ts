import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

/**
 * REST routes for the Workspace Sessions backend (per-project shell-state
 * snapshot persisted under `<project>/.vnextstudio/session.json`).
 */
export function registerSessionsRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/sessions/get', (c) => helper(c, 'sessions/get', { source: 'json' }));
  app.post('/sessions/save', (c) => helper(c, 'sessions/save', { source: 'json' }));
  app.post('/sessions/clear', (c) => helper(c, 'sessions/clear', { source: 'json' }));
}
