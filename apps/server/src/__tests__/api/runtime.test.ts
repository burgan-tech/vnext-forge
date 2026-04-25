import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { ERROR_CODES } from '@vnext-forge/app-contracts';
import { buildMethodRegistry, type ServiceRegistry } from '@vnext-forge/services-core';

import { createApiV1Router } from '../../api/v1/index.js';
import { errorHandler } from '../../shared/middleware/error-handler.js';
import { requestLoggerMiddleware } from '../../shared/middleware/logger.js';
import { traceIdMiddleware } from '../../shared/middleware/trace-id.js';
import type { Variables } from '../../shared/types/hono.js';

vi.mock('../../shared/config/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/config/config.js')>();
  return {
    ...actual,
    isLoopbackHost: vi.fn(() => false),
  };
});

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

describe('API v1 runtime routes', () => {
  it('returns 200 + envelope for runtime/proxy happy path', async () => {
    const proxied = { status: 200, contentType: 'application/json', data: '{}' };
    const services = {
      ...emptyServices,
      runtimeProxyService: {
        proxy: vi.fn(async () => proxied),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/runtime/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ method: 'GET', runtimePath: '/health' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: typeof proxied };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(proxied);
  });

  it('returns 400 when JSON body is invalid', async () => {
    const services = {
      ...emptyServices,
      runtimeProxyService: { proxy: vi.fn() },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/runtime/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_BAD_REQUEST);
  });

  it('returns 403 when origin is not allow-listed for runtime/proxy', async () => {
    const services = {
      ...emptyServices,
      runtimeProxyService: {
        proxy: vi.fn(async () => ({ status: 200, contentType: 'text/plain', data: '' })),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/runtime/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://blocked.example',
      },
      body: JSON.stringify({ method: 'GET', runtimePath: '/health' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_FORBIDDEN);
  });
});
