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
  quickrunGetFunctionCatalogParams,
  quickrunGetFunctionCatalogResult,
  quickrunGetIncidentsParams,
  quickrunGetIncidentsResult,
  quickrunGetActiveIncidentParams,
  quickrunGetActiveIncidentResult,
  quickrunGetTaskHistoryParams,
  quickrunGetTaskHistoryResult,
  quickrunAuthorizeParams,
  quickrunAuthorizeResult,
  quickrunGetHumanTasksParams,
  quickrunGetHumanTasksResult,
  quickrunGetCorrelationTreeParams,
  quickrunGetCorrelationTreeResult,
  quickrunGetElementMetricsParams,
  quickrunGetElementMetricsResult,
  quickrunGetFunctionMetricsParams,
  quickrunGetFunctionMetricsResult,
  type CorrelationTreeNode,
} from './quickrun-schemas.js'
import { compareCoreSemver, extractCoreSemver } from '../cli/semver.js'

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

/** The error every non-2xx runtime answer becomes; the body lands in `details`. */
function runtimeHttpError(data: string, status: number, source: string, traceId?: string): VnextForgeError {
  let details: Record<string, unknown> = { httpStatus: status }
  try {
    details = { ...details, ...JSON.parse(data) }
  } catch { /* non-JSON error body */ }
  return new VnextForgeError(
    status === 404 ? ERROR_CODES.RUNTIME_NOT_FOUND : ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    `Runtime returned HTTP ${status}`,
    { source, layer: 'infrastructure', details },
    traceId,
  )
}

function parseJsonResponse<T>(
  data: string,
  status: number,
  source: string,
  traceId?: string,
): T {
  if (status < 200 || status >= 300) {
    throw runtimeHttpError(data, status, source, traceId)
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

/** `Instance:100037` — `incidents/active` has nothing open. A normal answer. */
const ACTIVE_INCIDENT_NOT_FOUND = 'Instance:100037'

/**
 * The runtime error code of an error body, normalised to `<prefix>:<code>`.
 * Reads the Aether envelope (`{ error: { prefix, code } }`) and flat bodies.
 */
function runtimeErrorCode(data: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const outer = parsed as Record<string, unknown>
  const body = (outer.error && typeof outer.error === 'object' ? outer.error : outer) as Record<string, unknown>
  const code =
    typeof body.code === 'string' ? body.code : typeof body.errorCode === 'string' ? body.errorCode : undefined
  if (!code) return undefined
  const prefix = typeof body.prefix === 'string' ? body.prefix : undefined
  return prefix && !code.startsWith(`${prefix}:`) ? `${prefix}:${code}` : code
}

/** Case-insensitive response-header lookup. */
function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }
  return undefined
}

function instancePath(domain: string, workflowKey: string, instanceId: string): string {
  return `${buildBasePath(domain, workflowKey)}/instances/${encodeURIComponent(instanceId)}`
}

/** First runtime with `functions/instance-correlation` (it replaced `functions/hierarchy`). */
const CORRELATION_TREE_MIN_RUNTIME = '0.0.99'

/** `undefined` when the version is unknown, so the caller tries the new path and falls back on 404. */
function runtimeSupportsCorrelationTree(version: string | undefined): boolean | undefined {
  const core = version ? extractCoreSemver(version) : null
  if (!core) return undefined
  return compareCoreSemver(core, CORRELATION_TREE_MIN_RUNTIME) >= 0
}

/** Fills the fields the ≤ 0.0.98 `hierarchy` node lacks so both shapes read alike. */
export function normalizeCorrelationNode(raw: Record<string, unknown>): CorrelationTreeNode {
  const children = Array.isArray(raw.children) ? (raw.children as Record<string, unknown>[]) : []
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    ...(raw as Partial<CorrelationTreeNode>),
    id: String(raw.id ?? ''),
    flow: String(raw.flow ?? ''),
    domain: String(raw.domain ?? ''),
    ownState: str(raw.ownState) ?? str(raw.currentState),
    resolved: typeof raw.resolved === 'boolean' ? raw.resolved : true,
    children: children.map(normalizeCorrelationNode),
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
    const headers = { ...params.headers }
    if (params.ifNoneMatch) headers['If-None-Match'] = params.ifNoneMatch

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/state`,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status === 304) {
      return {
        notModified: true,
        responseHeaders: result.responseHeaders,
      } as z.infer<typeof quickrunGetStateResult>
    }

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

    if (result.status === 304) {
      return {
        notModified: true,
        responseHeaders: result.responseHeaders,
      } as z.infer<typeof quickrunGetDataResult>
    }

    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getData', traceId,
    )
    return { ...parsed, responseHeaders: result.responseHeaders } as z.infer<typeof quickrunGetDataResult>
  }

  async function getSchema(
    params: z.infer<typeof quickrunGetSchemaParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetSchemaResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)
    const query: Record<string, string> = {}
    if (params.transitionKey) query.transitionKey = params.transitionKey
    const headers = { ...params.headers }
    if (params.ifNoneMatch) headers['If-None-Match'] = params.ifNoneMatch

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/schema`,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status === 304) {
      return {
        notModified: true,
        responseHeaders: result.responseHeaders,
      } as z.infer<typeof quickrunGetSchemaResult>
    }

    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getSchema', traceId,
    )
    return { ...parsed, responseHeaders: result.responseHeaders } as z.infer<typeof quickrunGetSchemaResult>
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
   * Acknowledge a paused long poll. The endpoint is deterministic — built
   * from the workflow identifiers, not the engine-supplied href:
   *   POST /api/v1/<domain>/workflows/<flow>/instances/<instanceId>/longpoll/ack
   * The response is commonly empty, so no JSON is parsed on success. A
   * non-2xx is thrown so the QuickRunner can show why the acknowledge was
   * refused.
   */
  async function acknowledgeLongPoll(
    params: z.infer<typeof quickrunAcknowledgeLongPollParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunAcknowledgeLongPollResult>> {
    const result = await proxyCall(
      {
        method: 'POST',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/longpoll/ack`,
        query: params.role ? { role: params.role } : undefined,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status < 200 || result.status >= 300) {
      throw runtimeHttpError(result.data, result.status, 'QuickRunService.acknowledgeLongPoll', traceId)
    }
    return { ok: true, status: result.status }
  }

  /**
   * Lists the functions reachable on one instance.
   *
   * Like `acknowledgeLongPoll`, the path is rebuilt from the workflow
   * identifiers rather than followed from the state response's
   * `functions.href` — the engine's link is display-only here.
   */
  async function getFunctionCatalog(
    params: z.infer<typeof quickrunGetFunctionCatalogParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetFunctionCatalogResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${base}/instances/${params.instanceId}/functions/catalog`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getFunctionCatalog', traceId,
    )
    // An engine that answers with no `functions` array is reported as an
    // empty catalog rather than a parse failure — "no functions" is a
    // legitimate answer and the caller already renders nothing for it.
    return {
      functions: Array.isArray(parsed.functions) ? parsed.functions : [],
    } as z.infer<typeof quickrunGetFunctionCatalogResult>
  }

  async function getIncidents(
    params: z.infer<typeof quickrunGetIncidentsParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetIncidentsResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/incidents`,
        query: { page: String(params.page), pageSize: String(params.pageSize) },
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getIncidents', traceId,
    )
    return {
      hasActiveIncident: parsed.hasActiveIncident === true,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      page: typeof parsed.page === 'number' ? parsed.page : params.page,
      pageSize: typeof parsed.pageSize === 'number' ? parsed.pageSize : params.pageSize,
      hasNext: parsed.hasNext === true,
    } as z.infer<typeof quickrunGetIncidentsResult>
  }

  async function getActiveIncident(
    params: z.infer<typeof quickrunGetActiveIncidentParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetActiveIncidentResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/incidents/active`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    // The link is advertised while the flag is set, but a retry may have
    // resolved the incident since — "nothing open" is an answer, not a failure.
    if (result.status === 404 && runtimeErrorCode(result.data) === ACTIVE_INCIDENT_NOT_FOUND) {
      return { incident: null }
    }
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getActiveIncident', traceId,
    )
    return { incident: parsed } as z.infer<typeof quickrunGetActiveIncidentResult>
  }

  async function getTaskHistory(
    params: z.infer<typeof quickrunGetTaskHistoryParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetTaskHistoryResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/functions/tasks`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getTaskHistory', traceId,
    )
    return { items: Array.isArray(parsed.items) ? parsed.items : [] } as z.infer<typeof quickrunGetTaskHistoryResult>
  }

  async function authorize(
    params: z.infer<typeof quickrunAuthorizeParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunAuthorizeResult>> {
    const query: Record<string, string> = {}
    if (params.transitionKey) query.transitionKey = params.transitionKey
    if (params.functionKey) query.functionKey = params.functionKey
    if (params.queryRoles) query.queryRoles = 'true'
    if (params.ack) query.ack = 'true'
    if (params.role) query.role = params.role
    if (params.version) query.version = params.version

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/functions/authorize`,
        query,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status === 200 || result.status === 403) {
      let allowed: unknown
      try {
        allowed = (JSON.parse(result.data) as Record<string, unknown> | null)?.allowed
      } catch { /* handled below */ }
      if (typeof allowed === 'boolean') return { allowed, status: result.status }
      if (result.status === 403) {
        // A 403 without a verdict came from somewhere else (e.g. a gateway).
        throw runtimeHttpError(result.data, result.status, 'QuickRunService.authorize', traceId)
      }
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Authorize response has no boolean "allowed" field',
        { source: 'QuickRunService.authorize', layer: 'infrastructure', details: { rawData: result.data.slice(0, 200) } },
        traceId,
      )
    }
    throw runtimeHttpError(result.data, result.status, 'QuickRunService.authorize', traceId)
  }

  async function getHumanTasks(
    params: z.infer<typeof quickrunGetHumanTasksParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetHumanTasksResult>> {
    const headers: Record<string, string> = { ...(params.headers ?? {}) }
    if (params.cacheOverride) headers['X-VNext-Cache-Override'] = 'true'

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `/api/v1/${encodeURIComponent(params.domain)}/functions/human-task`,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    const parsed = parseJsonResponse<unknown>(result.data, result.status, 'QuickRunService.getHumanTasks', traceId)
    if (!Array.isArray(parsed)) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Human-task response is not a JSON array',
        { source: 'QuickRunService.getHumanTasks', layer: 'infrastructure', details: { rawData: result.data.slice(0, 200) } },
        traceId,
      )
    }
    return {
      items: parsed,
      truncated: headerValue(result.responseHeaders, 'X-VNext-HumanTask-Truncated')?.toLowerCase() === 'true',
    } as z.infer<typeof quickrunGetHumanTasksResult>
  }

  /**
   * Correlation tree of one instance. See `quickrunGetCorrelationTreeParams`
   * for the endpoint choice; the old `hierarchy` shape is normalized so the
   * caller renders one tree grammar.
   */
  async function getCorrelationTree(
    params: z.infer<typeof quickrunGetCorrelationTreeParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetCorrelationTreeResult>> {
    const fetchTree = (fn: 'instance-correlation' | 'hierarchy') =>
      proxyCall(
        {
          method: 'GET',
          runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/functions/${fn}`,
          headers: params.headers,
          runtimeUrl: params.runtimeUrl,
        },
        traceId,
      )

    const supportsTree = runtimeSupportsCorrelationTree(params.runtimeVersion)
    let source: 'instance-correlation' | 'hierarchy' = supportsTree === false ? 'hierarchy' : 'instance-correlation'
    let result = await fetchTree(source)
    if (result.status === 404 && supportsTree === undefined) {
      source = 'hierarchy'
      result = await fetchTree(source)
    }
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getCorrelationTree', traceId,
    )
    const root = parsed.root
    if (!root || typeof root !== 'object') {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Correlation response has no "root" node',
        { source: 'QuickRunService.getCorrelationTree', layer: 'infrastructure', details: { rawData: result.data.slice(0, 200) } },
        traceId,
      )
    }
    return { root: normalizeCorrelationNode(root as Record<string, unknown>), source }
  }

  async function getElementMetrics(
    kind: 'transitions' | 'states',
    params: z.infer<typeof quickrunGetElementMetricsParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetElementMetricsResult>> {
    const source = kind === 'transitions' ? 'QuickRunService.getTransitionMetrics' : 'QuickRunService.getStateMetrics'
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/${kind}/${encodeURIComponent(params.key)}/metrics`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(result.data, result.status, source, traceId)
    const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : []
    return {
      element: (parsed.element as { kind: 'transition' | 'state'; key: string } | undefined) ?? {
        kind: kind === 'transitions' ? 'transition' : 'state',
        key: params.key,
      },
      count: typeof parsed.count === 'number' ? parsed.count : attempts.length,
      attempts,
    } as z.infer<typeof quickrunGetElementMetricsResult>
  }

  async function getFunctionMetrics(
    params: z.infer<typeof quickrunGetFunctionMetricsParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetFunctionMetricsResult>> {
    const domain = encodeURIComponent(params.domain)
    const fn = encodeURIComponent(params.functionKey)
    const runtimePath = params.workflowKey
      ? `/api/v1/${domain}/workflows/${encodeURIComponent(params.workflowKey)}/functions/${fn}/metrics`
      : `/api/v1/${domain}/functions/${fn}/metrics`
    const query: Record<string, string> = {}
    if (params.page !== undefined) query.page = String(params.page)
    if (params.pageSize !== undefined) query.pageSize = String(params.pageSize)
    if (params.from) query.from = params.from
    if (params.to) query.to = params.to
    if (params.succeeded !== undefined) query.succeeded = String(params.succeeded)

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getFunctionMetrics', traceId,
    )
    const links = (parsed.links ?? {}) as Record<string, unknown>
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      summary: (parsed.summary as z.infer<typeof quickrunGetFunctionMetricsResult>['summary']) ?? null,
      hasNext: typeof links.next === 'string' && links.next.length > 0,
    } as z.infer<typeof quickrunGetFunctionMetricsResult>
  }

  return {
    getCorrelationTree,
    getTransitionMetrics: (params: z.infer<typeof quickrunGetElementMetricsParams>, traceId?: string) =>
      getElementMetrics('transitions', params, traceId),
    getStateMetrics: (params: z.infer<typeof quickrunGetElementMetricsParams>, traceId?: string) =>
      getElementMetrics('states', params, traceId),
    getFunctionMetrics,
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
    getFunctionCatalog,
    getIncidents,
    getActiveIncident,
    getTaskHistory,
    authorize,
    getHumanTasks,
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
