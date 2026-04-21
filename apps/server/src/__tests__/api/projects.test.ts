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

describe('API v1 projects routes', () => {
  it('returns 200 + success envelope for projects/list', async () => {
    const services = {
      ...emptyServices,
      projectService: {
        listProjects: vi.fn(async () => [{ id: 'a', domain: 'd', path: '/p' }]),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/projects/list');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 400 when projects/getById is missing id', async () => {
    const services = {
      ...emptyServices,
      projectService: { getProject: vi.fn() },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/projects/getById');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_BAD_REQUEST);
  });

  it('returns 403 for privileged projects/remove with disallowed origin', async () => {
    const services = {
      ...emptyServices,
      projectService: { removeProject: vi.fn(async () => ({ success: true })) },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/projects/remove?id=x', {
      method: 'DELETE',
      headers: { Origin: 'http://evil.test' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe(ERROR_CODES.API_FORBIDDEN);
  });

  it('returns 201 + envelope for projects/create', async () => {
    const created = {
      id: 'new-1',
      domain: 'dom',
      path: '/tmp/dom',
    };
    const services = {
      ...emptyServices,
      projectService: {
        createProject: vi.fn(async () => created),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/projects/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        domain: 'dom',
        description: 'desc',
        targetPath: '/tmp/dom',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: typeof created };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(created);
  });
});
