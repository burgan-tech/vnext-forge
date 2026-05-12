import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type { RuntimeProxyService } from '../runtime-proxy/runtime-proxy.service.js'
import {
  quickrunFireTransitionParams,
  quickrunFireTransitionResult,
  quickrunGetDataParams,
  quickrunGetDataResult,
  quickrunGetHistoryParams,
  quickrunGetHistoryResult,
  quickrunGetInstanceParams,
  quickrunGetInstanceResult,
  quickrunGetSchemaParams,
  quickrunGetSchemaResult,
  quickrunGetStateParams,
  quickrunGetStateResult,
  quickrunGetViewParams,
  quickrunGetViewResult,
  quickrunListInstancesParams,
  quickrunListInstancesResult,
  quickrunRetryInstanceParams,
  quickrunRetryInstanceResult,
  quickrunStartInstanceParams,
  quickrunStartInstanceResult,
} from './quickrun-schemas.js'

type ProxyRequest = {
  method: string
  runtimePath: string
  query?: Record<string, string>
  body?: string
  headers?: Record<string, string>
  runtimeUrl?: string
}

function buildBasePath(domain: string, workflowKey: string): string {
  return `/api/v1/${domain}/workflows/${workflowKey}`
}

function parseJsonResponse<T>(
  data: string,
  status: number,
  source: string,
  traceId?: string,
): T {
  if (status < 200 || status >= 300) {
    let details: Record<string, unknown> = { httpStatus: status }
    try {
      details = { ...details, ...JSON.parse(data) }
    } catch { /* non-JSON error body */ }
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_EXECUTION_FAILED,
      `Runtime returned HTTP ${status}`,
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }
  try {
    return JSON.parse(data) as T
  } catch {
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_INVALID_RESPONSE,
      'Failed to parse runtime response as JSON',
      { source, layer: 'infrastructure', details: { rawData: data.slice(0, 200) } },
      traceId,
    )
  }
}

export function createQuickRunService(runtimeProxyService: RuntimeProxyService) {
  async function proxyCall(req: ProxyRequest, traceId?: string) {
    return runtimeProxyService.proxy(
      {
        method: req.method,
        runtimePath: req.runtimePath,
        query: req.query,
        body: req.body,
        headers: req.headers,
        runtimeUrl: req.runtimeUrl,
      },
      traceId,
    )
  }

  async function startInstance(
    params: z.infer<typeof quickrunStartInstanceParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunStartInstanceResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const body: Record<string, unknown> = {}
    if (params.key) body.key = params.key
    if (params.stage) body.stage = params.stage
    if (params.tags) body.tags = params.tags
    if (params.attributes) body.attributes = params.attributes

    const query: Record<string, string> = { sync: String(params.sync) }
    if (params.version) query.version = params.version

    const result = await proxyCall(
      {
        method: 'POST',
        runtimePath: `${base}/instances/start`,
        query,
        body: JSON.stringify(body),
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.startInstance', traceId)
  }

  async function fireTransition(
    params: z.infer<typeof quickrunFireTransitionParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunFireTransitionResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const body: Record<string, unknown> = {}
    if (params.key) body.key = params.key
    if (params.stage) body.stage = params.stage
    if (params.tags) body.tags = params.tags
    if (params.attributes) body.attributes = params.attributes

    const result = await proxyCall(
      {
        method: 'PATCH',
        runtimePath: `${base}/instances/${params.instanceId}/transitions/${params.transitionKey}`,
        query: { sync: String(params.sync) },
        body: JSON.stringify(body),
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.fireTransition', traceId)
  }

  async function getState(
    params: z.infer<typeof quickrunGetStateParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetStateResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/state`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getState', traceId,
    )
    return { ...parsed, responseHeaders: result.responseHeaders } as z.infer<typeof quickrunGetStateResult>
  }

  async function getView(
    params: z.infer<typeof quickrunGetViewParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetViewResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const query: Record<string, string> = {}
    if (params.transitionKey) query.transitionKey = params.transitionKey

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/view`,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.getView', traceId)
  }

  async function getData(
    params: z.infer<typeof quickrunGetDataParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetDataResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const query: Record<string, string> = {}
    if (params.extensions) query.extensions = params.extensions
    const headers = { ...params.headers }
    if (params.ifNoneMatch) headers['If-None-Match'] = params.ifNoneMatch

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/data`,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.getData', traceId)
  }

  async function getSchema(
    params: z.infer<typeof quickrunGetSchemaParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetSchemaResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const query: Record<string, string> = {}
    if (params.transitionKey) query.transitionKey = params.transitionKey

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/schema`,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.getSchema', traceId)
  }

  async function getHistory(
    params: z.infer<typeof quickrunGetHistoryParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetHistoryResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/transitions`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.getHistory', traceId)
  }

  async function retryInstance(
    params: z.infer<typeof quickrunRetryInstanceParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunRetryInstanceResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const body: Record<string, unknown> = {}
    if (params.key) body.key = params.key
    if (params.stage) body.stage = params.stage
    if (params.tags) body.tags = params.tags
    if (params.attributes) body.attributes = params.attributes

    const result = await proxyCall(
      {
        method: 'POST',
        runtimePath: `${base}/instances/${params.instanceId}/retry`,
        body: JSON.stringify(body),
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.retryInstance', traceId)
  }

  async function listInstances(
    params: z.infer<typeof quickrunListInstancesParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunListInstancesResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const query: Record<string, string> = {
      page: String(params.page),
      pageSize: String(params.pageSize),
    }
    if (params.version) query.version = params.version
    if (params.orderBy) query.orderBy = params.orderBy
    if (params.sort) query.sort = params.sort
    if (params.extensions) query.extensions = params.extensions
    if (params.filter) query.filter = params.filter

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances`,
        query,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.listInstances', traceId)
  }

  async function getInstance(
    params: z.infer<typeof quickrunGetInstanceParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetInstanceResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return parseJsonResponse(result.data, result.status, 'QuickRunService.getInstance', traceId)
  }

  return {
    startInstance,
    fireTransition,
    getState,
    getView,
    getData,
    getSchema,
    getHistory,
    retryInstance,
    listInstances,
    getInstance,
  }
}

export type QuickRunService = ReturnType<typeof createQuickRunService>
