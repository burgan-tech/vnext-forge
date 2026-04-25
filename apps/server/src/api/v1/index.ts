import { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { registerFilesRoutes } from './files.routes.js';
import { registerHealthRoutes } from './health.routes.js';
import { registerProjectsRoutes } from './projects.routes.js';
import { registerRuntimeRoutes } from './runtime.routes.js';
import { registerTemplatesRoutes } from './templates.routes.js';
import { registerValidateRoutes } from './validate.routes.js';
import { registerVnextRoutes } from './vnext.routes.js';

export function createApiV1Router(deps: { registry: MethodRegistry; services: ServiceRegistry }) {
  const app = new Hono<{ Variables: Variables }>();
  registerFilesRoutes(app, deps);
  registerProjectsRoutes(app, deps);
  registerValidateRoutes(app, deps);
  registerTemplatesRoutes(app, deps);
  registerRuntimeRoutes(app, deps);
  registerHealthRoutes(app, deps);
  registerVnextRoutes(app, deps);
  return app;
}
