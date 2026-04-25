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

describe('API v1 files routes', () => {
  it('returns 200 + success envelope for files/read happy path', async () => {
    const services = {
      workspaceService: {
        readFile: vi.fn(async () => 'hello'),
      },
      projectService: {},
      templateService: {},
      validateService: {},
      runtimeProxyService: {},
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/files/read?path=some/path.txt', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { content: string } };
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('hello');
  });

  it('returns 400 + API_BAD_REQUEST when params fail validation', async () => {
    const services = {
      workspaceService: { readFile: vi.fn() },
      projectService: {},
      templateService: {},
      validateService: {},
      runtimeProxyService: {},
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/files/read', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.API_BAD_REQUEST);
  });

  it('returns 403 for privileged files/read when origin is not allow-listed', async () => {
    const services = {
      workspaceService: { readFile: vi.fn(async () => 'x') },
      projectService: {},
      templateService: {},
      validateService: {},
      runtimeProxyService: {},
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/files/read?path=p', {
      headers: { Origin: 'http://malicious.example' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.API_FORBIDDEN);
  });
});
