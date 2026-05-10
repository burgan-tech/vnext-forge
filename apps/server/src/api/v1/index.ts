import { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { registerCliRoutes } from './cli.routes.js';
import { registerFilesRoutes } from './files.routes.js';
import { registerHealthRoutes } from './health.routes.js';
import { registerProjectsRoutes } from './projects.routes.js';
import { registerQuickrunRoutes } from './quickrun.routes.js';
import { registerQuickswitcherRoutes } from './quickswitcher.routes.js';
import { registerRuntimeRoutes } from './runtime.routes.js';
import { registerSessionsRoutes } from './sessions.routes.js';
import { registerQuickRunPresetsRoutes } from './quickrun-presets.routes.js';
import { registerSnippetsRoutes } from './snippets.routes.js';
import { registerTemplatesRoutes } from './templates.routes.js';
import { registerTestDataRoutes } from './test-data.routes.js';
import { registerValidateRoutes } from './validate.routes.js';
import { registerVnextRoutes } from './vnext.routes.js';

export function createApiV1Router(deps: { registry: MethodRegistry; services: ServiceRegistry }) {
  const app = new Hono<{ Variables: Variables }>();
  registerCliRoutes(app, deps);
  registerFilesRoutes(app, deps);
  registerProjectsRoutes(app, deps);
  registerValidateRoutes(app, deps);
  registerTemplatesRoutes(app, deps);
  registerQuickrunRoutes(app, deps);
  registerRuntimeRoutes(app, deps);
  registerHealthRoutes(app, deps);
  registerVnextRoutes(app, deps);
  registerQuickswitcherRoutes(app, deps);
  registerSnippetsRoutes(app, deps);
  registerSessionsRoutes(app, deps);
  registerTestDataRoutes(app, deps);
  registerQuickRunPresetsRoutes(app, deps);
  return app;
}
