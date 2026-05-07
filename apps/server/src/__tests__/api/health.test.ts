import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';
import { buildMethodRegistry, type ServiceRegistry } from '@vnext-forge-studio/services-core';

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

describe('API v1 health routes', () => {
  it('returns 200 + ok when runtime proxy succeeds', async () => {
    const services = {
      ...emptyServices,
      runtimeProxyService: {
        proxy: vi.fn(async () => ({
          status: 200,
          contentType: 'application/json',
          data: '{}',
        })),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/health/check');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('returns 200 + down when runtime is unreachable (degraded success)', async () => {
    const services = {
      ...emptyServices,
      runtimeProxyService: {
        proxy: vi.fn(async () => {
          throw new VnextForgeError(
            ERROR_CODES.RUNTIME_CONNECTION_FAILED,
            'down',
            { source: 'test', layer: 'infrastructure' },
          );
        }),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/health/check');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('down');
  });

  it('allows health/check for public callers even with a hostile Origin', async () => {
    const services = {
      ...emptyServices,
      runtimeProxyService: {
        proxy: vi.fn(async () => ({
          status: 200,
          contentType: 'application/json',
          data: '{}',
        })),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/health/check', {
      headers: { Origin: 'http://untrusted.example' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
