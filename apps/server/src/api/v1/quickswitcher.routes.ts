import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

/**
 * REST routes for the Quick Switcher (Cmd+P) backend.
 *
 * Single method today; kept in its own file to mirror the existing
 * one-domain-per-file convention (see `projects.routes.ts`,
 * `validate.routes.ts`, etc.).
 */
export function registerQuickswitcherRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/quickswitcher/buildIndex', (c) =>
    helper(c, 'quickswitcher/buildIndex', { source: 'json' }),
  );
}
