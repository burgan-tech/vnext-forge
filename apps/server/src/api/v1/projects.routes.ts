import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerProjectsRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.get('/projects/list', (c) => helper(c, 'projects/list', { source: 'query' }));
  app.get('/projects/getById', (c) => helper(c, 'projects/getById', { source: 'query' }));
  app.post('/projects/create', (c) => helper(c, 'projects/create', { source: 'json' }));
  app.post('/projects/import', (c) => helper(c, 'projects/import', { source: 'json' }));
  app.delete('/projects/remove', (c) => helper(c, 'projects/remove', { source: 'query' }));
  app.post('/projects/export', (c) => helper(c, 'projects/export', { source: 'json' }));
  app.get('/projects/getTree', (c) => helper(c, 'projects/getTree', { source: 'query' }));
  app.get('/projects/getConfig', (c) => helper(c, 'projects/getConfig', { source: 'query' }));
  app.get('/projects/getConfigStatus', (c) => helper(c, 'projects/getConfigStatus', { source: 'query' }));
  app.put('/projects/writeConfig', (c) => helper(c, 'projects/writeConfig', { source: 'json' }));
  app.get('/projects/getVnextComponentLayoutStatus', (c) =>
    helper(c, 'projects/getVnextComponentLayoutStatus', { source: 'query' }),
  );
  app.put('/projects/seedVnextComponentLayout', (c) =>
    helper(c, 'projects/seedVnextComponentLayout', { source: 'json' }),
  );
  app.get('/projects/getValidateScriptStatus', (c) =>
    helper(c, 'projects/getValidateScriptStatus', { source: 'query' }),
  );
  app.get('/projects/getComponentFileTypes', (c) =>
    helper(c, 'projects/getComponentFileTypes', { source: 'query' }),
  );
  app.get('/projects/getWorkspaceBootstrap', (c) =>
    helper(c, 'projects/getWorkspaceBootstrap', { source: 'query' }),
  );
}
