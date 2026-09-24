import { ERROR_CODES } from '@vnext-forge-studio/app-contracts'
import { describe, expect, it, vi } from 'vitest'

import { createQuickRunService } from '../src/index.js'

function serviceWith(response: { status: number; data: string; responseHeaders?: Record<string, string> }) {
  const proxy = vi.fn().mockResolvedValue({
    status: response.status,
    contentType: 'application/json',
    data: response.data,
    responseHeaders: response.responseHeaders ?? {},
  })
  return { service: createQuickRunService({ proxy } as never), proxy }
}

const ids = { domain: 'core', workflowKey: 'error-boundary-lab', instanceId: 'i-1' }

const INCIDENT = {
  id: 'a1',
  createdAt: '2026-09-20T10:00:00Z',
  state: 'call-api',
  transition: 'go',
  task: 'http-fail',
  message: 'Upstream 503',
  errorCode: 'Task:Http:503',
  errorLayer: 'Task',
  statusCode: 503,
  boundaryAction: 'Abort',
  boundaryLevel: 'Task',
  traceId: 't-1',
  isResolved: false,
  resolvedAt: null,
  retryCount: 0,
}

describe('quickRunService.getIncidents', () => {
  it('pages the incident history from a path rebuilt from identifiers', async () => {
    const { service, proxy } = serviceWith({
      status: 200,
      data: JSON.stringify({ hasActiveIncident: true, items: [INCIDENT], page: 2, pageSize: 5, hasNext: false }),
    })
    const result = await service.getIncidents({ ...ids, page: 2, pageSize: 5 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/incidents',
        query: { page: '2', pageSize: '5' },
      }),
      undefined,
    )
    expect(result).toEqual({ hasActiveIncident: true, items: [INCIDENT], page: 2, pageSize: 5, hasNext: false })
  })

  it('encodes the instance id segment', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"items":[]}' })
    await service.getIncidents({ ...ids, instanceId: 'a/b', page: 1, pageSize: 20 })
    expect(proxy.mock.calls[0][0].runtimePath).toBe('/api/v1/core/workflows/error-boundary-lab/instances/a%2Fb/incidents')
  })

  it('throws a runtime error on a 403', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"x"}}' })
    await expect(service.getIncidents({ ...ids, page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickRunService.getActiveIncident', () => {
  it('returns the open incident', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify(INCIDENT) })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: INCIDENT })
    expect(proxy.mock.calls[0][0].runtimePath).toBe(
      '/api/v1/core/workflows/error-boundary-lab/instances/i-1/incidents/active',
    )
  })

  it('treats 404 Instance:100037 (Aether envelope) as "no open incident"', async () => {
    const { service } = serviceWith({
      status: 404,
      data: JSON.stringify({ error: { prefix: 'Instance', code: '100037', message: 'No active incident' } }),
    })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: null })
  })

  it('treats 404 Instance:100037 (flat code) as "no open incident"', async () => {
    const { service } = serviceWith({ status: 404, data: JSON.stringify({ code: 'Instance:100037' }) })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: null })
  })

  it('still fails on any other 404', async () => {
    const { service } = serviceWith({ status: 404, data: JSON.stringify({ code: 'Instance:100001' }) })
    await expect(service.getActiveIncident(ids)).rejects.toMatchObject({ code: ERROR_CODES.RUNTIME_EXECUTION_FAILED })
  })
})

describe('quickRunService.getTaskHistory', () => {
  it('reads the tasks function of the instance', async () => {
    const item = {
      id: 't1', taskKey: 'send-otp', transitionKey: 'approve', fromState: 'draft', toState: 'approved',
      triggerType: 'manual', status: 'completed', businessStatus: 'success',
      startedAt: '2026-09-20T10:00:00Z', finishedAt: '2026-09-20T10:00:01Z', durationMs: 184.2, error: null,
    }
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify({ items: [item] }) })
    expect(await service.getTaskHistory(ids)).toEqual({ items: [item] })
    expect(proxy.mock.calls[0][0].runtimePath).toBe(
      '/api/v1/core/workflows/error-boundary-lab/instances/i-1/functions/tasks',
    )
  })

  it('reports a body without items as an empty history', async () => {
    const { service } = serviceWith({ status: 200, data: '{}' })
    expect(await service.getTaskHistory(ids)).toEqual({ items: [] })
  })
})
