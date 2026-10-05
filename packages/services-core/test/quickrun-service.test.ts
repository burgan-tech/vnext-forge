import { ERROR_CODES } from '@vnext-forge-studio/app-contracts'
import { describe, expect, it, vi } from 'vitest'

import { createQuickRunService } from '../src/index.js'
import { quickrunAuthorizeParams } from '../src/services/quickrun/quickrun-schemas.js'

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

  it('throws a runtime error on a non-2xx instead of reporting an empty history', async () => {
    const { service } = serviceWith({ status: 404, data: JSON.stringify({ code: 'Function:100001' }) })
    await expect(service.getTaskHistory(ids)).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickrunAuthorizeParams', () => {
  it('requires exactly one selector', () => {
    expect(quickrunAuthorizeParams.safeParse(ids).success).toBe(false)
    expect(quickrunAuthorizeParams.safeParse({ ...ids, transitionKey: 'a', ack: true }).success).toBe(false)
    expect(quickrunAuthorizeParams.safeParse({ ...ids, queryRoles: true }).success).toBe(true)
  })
})

describe('quickRunService.authorize', () => {
  it('returns the verdict of a 200 and sends selector, role and version as query', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"allowed":true}' })
    const result = await service.authorize({ ...ids, transitionKey: 'approve', role: 'ht-approver', version: '1.0.0' })
    expect(result).toEqual({ allowed: true, status: 200 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/functions/authorize',
        query: { transitionKey: 'approve', role: 'ht-approver', version: '1.0.0' },
      }),
      undefined,
    )
  })

  it('returns a 403 {"allowed":false} as a verdict, not an error', async () => {
    const { service } = serviceWith({ status: 403, data: '{"allowed":false}' })
    expect(await service.authorize({ ...ids, queryRoles: true })).toEqual({ allowed: false, status: 403 })
  })

  it('sends queryRoles / ack as "true"', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"allowed":true}' })
    await service.authorize({ ...ids, ack: true })
    expect(proxy.mock.calls[0][0].query).toEqual({ ack: 'true' })
  })

  it('treats a 403 without a verdict body as a failure', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"Authorization:110001"}}' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })

  it('treats a 200 without a boolean "allowed" as an invalid response', async () => {
    const { service } = serviceWith({ status: 200, data: '{}' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_INVALID_RESPONSE,
    })
  })

  it('fails on any other status', async () => {
    const { service } = serviceWith({ status: 500, data: 'boom' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickRunService.getHumanTasks', () => {
  const ROW = {
    instanceId: 'APP-1', id: '11111111-2222-3333-4444-555555555555', workflow: 'ht-a',
    title: 'Approve application', description: 'Level A', createdAt: '2026-09-20T10:00:00Z', vNext: true,
  }

  it('calls the domain function with the cache override header', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify([ROW]) })
    const result = await service.getHumanTasks({ domain: 'core', cacheOverride: true, headers: { role: 'ht-approver' } })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/functions/human-task',
        headers: { role: 'ht-approver', 'X-VNext-Cache-Override': 'true' },
      }),
      undefined,
    )
    expect(result).toEqual({ items: [ROW], truncated: false })
  })

  it('reads truncation from the response header, case-insensitively', async () => {
    const { service } = serviceWith({
      status: 200, data: '[]', responseHeaders: { 'X-VNext-HumanTask-Truncated': 'true' },
    })
    expect((await service.getHumanTasks({ domain: 'core' })).truncated).toBe(true)
  })

  it('rejects a body that is not an array', async () => {
    const { service } = serviceWith({ status: 200, data: '{"items":[]}' })
    await expect(service.getHumanTasks({ domain: 'core' })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_INVALID_RESPONSE,
    })
  })
})

describe('quickRunService.acknowledgeLongPoll', () => {
  it('sends the acknowledging role as a query parameter', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '' })
    expect(await service.acknowledgeLongPoll({ ...ids, role: 'approver' })).toEqual({ ok: true, status: 200 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/longpoll/ack',
        query: { role: 'approver' },
      }),
      undefined,
    )
  })

  it('surfaces a non-2xx instead of swallowing it', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"x"}}' })
    await expect(service.acknowledgeLongPoll(ids)).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickRunService.getCorrelationTree', () => {
  const HIERARCHY = {
    root: {
      id: 'p',
      key: 'k',
      flow: 'parent',
      domain: 'core',
      currentState: 's1',
      status: 'B',
      children: [{ id: 'c', flow: 'child', domain: 'core', currentState: 'x', subFlowType: 'S', children: [] }],
    },
  }

  function sequenced(...responses: Array<{ status: number; data: string }>) {
    const proxy = vi.fn()
    for (const r of responses) proxy.mockResolvedValueOnce({ ...r, contentType: 'application/json', responseHeaders: {} })
    return { service: createQuickRunService({ proxy } as never), proxy }
  }

  it('calls instance-correlation on runtime 0.0.99+', async () => {
    const { service, proxy } = sequenced({ status: 200, data: JSON.stringify({ root: { ...HIERARCHY.root, resolved: true, ownState: 's1' } }) })
    const result = await service.getCorrelationTree({ ...ids, runtimeVersion: '0.0.99.0' })
    expect(proxy.mock.calls[0][0].runtimePath).toBe('/api/v1/core/workflows/error-boundary-lab/instances/i-1/functions/instance-correlation')
    expect(result.source).toBe('instance-correlation')
  })

  it('calls hierarchy on an older runtime and normalizes the nodes', async () => {
    const { service, proxy } = sequenced({ status: 200, data: JSON.stringify(HIERARCHY) })
    const result = await service.getCorrelationTree({ ...ids, runtimeVersion: '0.0.97' })
    expect(proxy.mock.calls[0][0].runtimePath).toMatch(/\/functions\/hierarchy$/)
    expect(result.source).toBe('hierarchy')
    expect(result.root).toMatchObject({ resolved: true, ownState: 's1' })
    expect(result.root.children[0]).toMatchObject({ resolved: true, ownState: 'x', subFlowType: 'S' })
  })

  it('falls back to hierarchy on 404 when the version is unknown', async () => {
    const { service, proxy } = sequenced(
      { status: 404, data: '{"code":"Cache:300001"}' },
      { status: 200, data: JSON.stringify(HIERARCHY) },
    )
    const result = await service.getCorrelationTree(ids)
    expect(proxy).toHaveBeenCalledTimes(2)
    expect(result.source).toBe('hierarchy')
  })

  it('does not fall back when the version says the tree exists', async () => {
    const { service } = sequenced({ status: 404, data: '{"code":"Instance:404"}' })
    await expect(service.getCorrelationTree({ ...ids, runtimeVersion: '0.0.99' })).rejects.toBeDefined()
  })
})

describe('quickRunService metrics', () => {
  it('builds the transition and state metrics paths', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"element":{"kind":"state","key":"a b"},"count":0,"attempts":[]}' })
    await service.getTransitionMetrics({ ...ids, key: 'to-review' })
    await service.getStateMetrics({ ...ids, key: 'a b' })
    expect(proxy.mock.calls[0][0].runtimePath).toBe('/api/v1/core/workflows/error-boundary-lab/instances/i-1/transitions/to-review/metrics')
    expect(proxy.mock.calls[1][0].runtimePath).toBe('/api/v1/core/workflows/error-boundary-lab/instances/i-1/states/a%20b/metrics')
  })

  it('reads function metrics from the domain or flow-scoped path and derives hasNext', async () => {
    const { service, proxy } = serviceWith({
      status: 200,
      data: JSON.stringify({ links: { next: '/next' }, items: [], summary: { count: 0 } }),
    })
    const domainLevel = await service.getFunctionMetrics({ domain: 'core', functionKey: 'score', page: 2, succeeded: false })
    await service.getFunctionMetrics({ domain: 'core', functionKey: 'score', workflowKey: 'wf' })
    expect(proxy.mock.calls[0][0]).toMatchObject({
      runtimePath: '/api/v1/core/functions/score/metrics',
      query: { page: '2', succeeded: 'false' },
    })
    expect(proxy.mock.calls[1][0].runtimePath).toBe('/api/v1/core/workflows/wf/functions/score/metrics')
    expect(domainLevel.hasNext).toBe(true)
  })
})
