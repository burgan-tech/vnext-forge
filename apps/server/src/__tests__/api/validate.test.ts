import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { ERROR_CODES } from '@vnext-forge/app-contracts';
import { buildMethodRegistry, type ServiceRegistry } from '@vnext-forge/services-core';

import { createApiV1Router } from '../../api/v1/index.js';
import { errorHandler } from '../../shared/middleware/error-handler.js';
import { requestLoggerMiddleware } from '../../shared/middleware/logger.js';
import { traceIdMiddleware } from '../../shared/middleware/trace-id.js';
import type { Variables } from '../../shared/types/hono.js';

function buildTestApp(services: ServiceRegistry) {
  const registry = buildMethodRegistry();
  const v1 = createApiV1Router({ registry, services });
  const app = new Hono<{ Variables: Variables }>()
    .use('*', traceIdMiddleware)
    .use('*', requestLoggerMiddleware)
    .route('/api/v1', v1);
  app.onError(errorHandler);
  return app;
}

const emptyServices = {
  workspaceService: {},
  projectService: {},
  templateService: {},
  validateService: {},
  runtimeProxyService: {},
} as unknown as ServiceRegistry;

describe('API v1 validate routes', () => {
  it('returns 200 for validate/getAvailableTypes', async () => {
    const services = {
      ...emptyServices,
      validateService: {
        getAvailableTypes: vi.fn(async () => ['workflow']),
        validate: vi.fn(),
        validateComponent: vi.fn(),
        getAllSchemas: vi.fn(),
        getSchema: vi.fn(),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/validate/getAvailableTypes');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: string[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(['workflow']);
  });

  it('returns 400 when validate/workflow body is invalid JSON', async () => {
    const services = {
      ...emptyServices,
      validateService: {
        getAvailableTypes: vi.fn(),
        validate: vi.fn(),
        validateComponent: vi.fn(),
        getAllSchemas: vi.fn(),
        getSchema: vi.fn(),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/validate/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_BAD_REQUEST);
  });

  it('returns 400 when validate/getSchema is missing type', async () => {
    const services = {
      ...emptyServices,
      validateService: {
        getAvailableTypes: vi.fn(),
        validate: vi.fn(),
        validateComponent: vi.fn(),
        getAllSchemas: vi.fn(),
        getSchema: vi.fn(),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/validate/getSchema');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_BAD_REQUEST);
  });
});
