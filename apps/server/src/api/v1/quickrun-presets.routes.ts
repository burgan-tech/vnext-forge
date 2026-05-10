import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

/**
 * REST routes for QuickRun preset CRUD. All four endpoints accept POST JSON
 * and read/write under the user's `<userData>/quickrun-presets/` directory —
 * never inside the project tree.
 */
export function registerQuickRunPresetsRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/quickrun-presets/list', (c) =>
    helper(c, 'quickrun-presets/list', { source: 'json' }),
  );
  app.post('/quickrun-presets/get', (c) =>
    helper(c, 'quickrun-presets/get', { source: 'json' }),
  );
  app.post('/quickrun-presets/save', (c) =>
    helper(c, 'quickrun-presets/save', { source: 'json' }),
  );
  app.post('/quickrun-presets/delete', (c) =>
    helper(c, 'quickrun-presets/delete', { source: 'json' }),
  );
}
