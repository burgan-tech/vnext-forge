import type { Hono } from 'hono';
import type { MethodRegistry, ServiceRegistry } from '@vnext-forge-studio/services-core';

import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

/**
 * REST routes for the test-data generator. Both endpoints accept POST JSON;
 * the generic `generate` accepts any JSON Schema, while
 * `generateForSchemaComponent` resolves a vNext Schema component
 * (`Schemas/<group>/<name>.json`) to its embedded `attributes.schema`.
 */
export function registerTestDataRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  app.post('/test-data/generate', (c) => helper(c, 'test-data/generate', { source: 'json' }));
  app.post('/test-data/generateForSchemaComponent', (c) =>
    helper(c, 'test-data/generateForSchemaComponent', { source: 'json' }),
  );
  app.post('/test-data/generateForSchemaReference', (c) =>
    helper(c, 'test-data/generateForSchemaReference', { source: 'json' }),
  );
}
