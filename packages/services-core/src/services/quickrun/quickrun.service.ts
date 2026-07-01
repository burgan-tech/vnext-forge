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
  quickrunExecuteFunctionParams,
  quickrunExecuteFunctionResult,
  quickrunAcknowledgeLongPollParams,
  quickrunAcknowledgeLongPollResult,
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

  /**
   * Execute a vNext function URN against the engine. Backs the Quick
   * Runner pseudo-ui delegate's `requestData` (x-lov / x-lookup) and
   * `dispatch + fn URN` action paths.
   *
   * URN shape drives the engine path (per vNext OpenAPI):
   *
   *   `urn:vnext:fn[:<verb>]:<domain>:<function>`             → domain endpoint
   *     <verb> /api/v1/{domain}/functions/{function}
   *     Stateless catalog lookup; x-lov / x-lookup default home.
   *
   *   `urn:vnext:fn[:<verb>]:<domain>:<flow>:<instance>:<function>`
   *                                                          → instance-scoped
   *     <verb> /api/v1/{domain}/workflows/{flow}/instances/{instance}/functions/{function}
   *     Workflow-state-aware function. Both `<flow>` and `<instance>`
   *     come from the URN (resolved upstream — `${instanceId}` etc).
   *
   * `<verb>` is one of `get/post/patch/delete` (default `get` when
   * omitted). `params.method` overrides the URN-embedded verb.
   *
   * Filter params land in the URL query string for GET/DELETE and in
   * the JSON body for POST/PATCH. The result body is forwarded to
   * the SDK as-is — `dataClient.extractByPath` runs JsonPath on it
   * (`valueField` / `displayField` for x-lov, `resultField` for
   * x-lookup).
   */
  async function executeFunction(
    params: z.infer<typeof quickrunExecuteFunctionParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunExecuteFunctionResult>> {
    const parsed = parseVnextFnUrn(params.functionUrn, traceId)
    const verb = (params.method ?? parsed.command).toUpperCase()

    let runtimePath: string
    if (parsed.scope === 'workflow') {
      runtimePath =
        `/api/v1/${encodeURIComponent(parsed.domain)}` +
        `/workflows/${encodeURIComponent(parsed.flow)}` +
        `/instances/${encodeURIComponent(parsed.instance)}` +
        `/functions/${encodeURIComponent(parsed.function)}`
    } else {
      // Domain-level stateless endpoint.
      runtimePath =
        `/api/v1/${encodeURIComponent(parsed.domain)}` +
        `/functions/${encodeURIComponent(parsed.function)}`
    }

    // Body-bearing verbs send the SDK-resolved params as a JSON
    // payload; GET/DELETE keep them in the query string.
    const hasBody = verb === 'POST' || verb === 'PATCH'
    const proxyArgs = hasBody
      ? {
          method: verb,
          runtimePath,
          body: params.params ? JSON.stringify(params.params) : undefined,
          headers: { ...(params.headers ?? {}), 'content-type': 'application/json' },
          runtimeUrl: params.runtimeUrl,
        }
      : {
          method: verb,
          runtimePath,
          query: params.params,
          headers: params.headers,
          runtimeUrl: params.runtimeUrl,
        }

    const result = await proxyCall(proxyArgs, traceId)

    return parseJsonResponse(result.data, result.status, 'QuickRunService.executeFunction', traceId)
  }

  /**
   * Silently acknowledge a terminated long poll. The endpoint is
   * deterministic — built from the workflow identifiers, not the
   * engine-supplied href — and current request headers are forwarded:
   *   POST /api/v1/<domain>/workflows/<flow>/instances/<instanceId>/longpoll/ack
   * We only report the HTTP status. The ack response is commonly
   * 204/empty, so we do NOT run `parseJsonResponse` here — a non-2xx
   * status is surfaced via `ok: false` rather than thrown, since the
   * caller treats ack failures as silent (logged client-side only).
   */
  async function acknowledgeLongPoll(
    params: z.infer<typeof quickrunAcknowledgeLongPollParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunAcknowledgeLongPollResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'POST',
        runtimePath: `${base}/instances/${params.instanceId}/longpoll/ack`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    return { ok: result.status >= 200 && result.status < 300, status: result.status }
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
    executeFunction,
    acknowledgeLongPoll,
  }
}

/**
 * Discriminated parser for `urn:vnext:fn:` shapes. Mirrors the
 * consumer-side `parseVnextUrn` in packages/designer-ui but kept
 * inline here so services-core stays dependency-free of designer-ui.
 *
 *   After the `urn:vnext:fn:` prefix:
 *     2 segments → scope=domain    (catalog lookup)
 *     4 segments → scope=workflow  (instance-scoped function)
 *   The first segment may optionally be one of `get/post/patch/delete`
 *   in which case it is the HTTP verb; default `get` otherwise.
 */
type FnCommand = 'get' | 'post' | 'patch' | 'delete'

type ParsedFnUrn =
  | { scope: 'domain'; command: FnCommand; domain: string; function: string }
  | {
      scope: 'workflow'
      command: FnCommand
      domain: string
      flow: string
      instance: string
      function: string
    }

const FN_COMMANDS: readonly FnCommand[] = ['get', 'post', 'patch', 'delete'] as const

function isFnCommand(value: string): value is FnCommand {
  return (FN_COMMANDS as readonly string[]).includes(value)
}

function parseVnextFnUrn(urn: string, traceId?: string): ParsedFnUrn {
  const PREFIX = 'urn:vnext:fn:'
  if (!urn.startsWith(PREFIX)) {
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_EXECUTION_FAILED,
      `Invalid function URN: expected prefix "${PREFIX}", got "${urn}"`,
      { source: 'QuickRunService.executeFunction', layer: 'application', details: { urn } },
      traceId,
    )
  }
  const tail = urn.slice(PREFIX.length)
  const parts = tail.split(':').map((p) => p.trim())

  let command: FnCommand = 'get'
  let rest = parts
  if (parts.length > 0 && isFnCommand(parts[0])) {
    command = parts[0]
    rest = parts.slice(1)
  }

  if (rest.length === 2 && rest[0] && rest[1]) {
    return { scope: 'domain', command, domain: rest[0], function: rest[1] }
  }
  if (rest.length === 4 && rest[0] && rest[1] && rest[2] && rest[3]) {
    return {
      scope: 'workflow',
      command,
      domain: rest[0],
      flow: rest[1],
      instance: rest[2],
      function: rest[3],
    }
  }
  throw new VnextForgeError(
    ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    `Invalid function URN: expected 2 or 4 segments (after optional verb) following "${PREFIX}", got "${urn}"`,
    { source: 'QuickRunService.executeFunction', layer: 'application', details: { urn } },
    traceId,
  )
}

export type QuickRunService = ReturnType<typeof createQuickRunService>
