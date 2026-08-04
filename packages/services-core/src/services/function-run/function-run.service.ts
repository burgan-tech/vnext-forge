import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { type z } from 'zod'

import type { RuntimeProxyService } from '../runtime-proxy/runtime-proxy.service.js'
import { buildFunctionInfoPath, isValidRuntimePath, normalizeRuntimeHref } from './function-run-paths.js'
import {
  type functionsFetchContractParams,
  type functionsGetInfoParams,
  type functionsInvokeParams,
  type functionExchangeResult,
} from './function-run-schemas.js'

type Exchange = z.infer<typeof functionExchangeResult>

function toExchange(result: {
  status: number
  contentType: string
  data: string
  responseHeaders?: Record<string, string>
}): Exchange {
  const exchange: Exchange = {
    status: result.status,
    contentType: result.contentType,
    responseHeaders: result.responseHeaders ?? {},
    body: result.data,
  }
  // Parse only when the engine says JSON. A parse failure is recorded via
  // `jsonParseError` rather than swallowed — a malformed JSON body is exactly
  // what this service exists to surface, not paper over. `body` always
  // carries the raw text regardless of which branch runs.
  if (result.contentType.toLowerCase().includes('json') && result.data.length > 0) {
    try {
      exchange.json = JSON.parse(result.data)
    } catch (error) {
      exchange.jsonParseError = error instanceof Error ? error.message : 'Failed to parse response body as JSON'
    }
  }
  return exchange
}

function assertRuntimePath(path: string, source: string, traceId?: string): void {
  if (isValidRuntimePath(path)) return
  throw new VnextForgeError(
    ERROR_CODES.API_BAD_REQUEST,
    'This href is not a valid runtime function route (must be a same-origin /functions/ path built only from the allowed URL characters).',
    { source, layer: 'domain', details: { path } },
    traceId,
  )
}

/**
 * Splits a query string embedded in an href (as `/info` returns them, e.g.
 * `/core/functions/f/view?target=input`) away from the path, so it can be
 * merged with an explicit `query` param instead of being concatenated a
 * second time. `runtime-proxy` appends `req.query` unconditionally, so
 * passing a `runtimePath` that already ends in `?target=input` alongside a
 * `query` of `{ page: '1' }` would produce `...?target=input?page=1`,
 * silently corrupting `target` into `input?page=1`.
 */
function splitEmbeddedQuery(href: string): { path: string; query: Record<string, string> } {
  const separatorIndex = href.indexOf('?')
  if (separatorIndex === -1) return { path: href, query: {} }
  const path = href.slice(0, separatorIndex)
  const queryString = href.slice(separatorIndex + 1)
  const query: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(queryString)) {
    query[key] = value
  }
  return { path, query }
}

export function createFunctionRunService(runtimeProxyService: RuntimeProxyService) {
  async function exchange(
    req: {
      method: string
      runtimePath: string
      query?: Record<string, string>
      body?: string
      headers?: Record<string, string>
      runtimeUrl?: string
    },
    traceId?: string,
  ): Promise<Exchange> {
    const result = await runtimeProxyService.proxy(req, traceId)
    return toExchange(result)
  }

  async function getInfo(
    params: z.infer<typeof functionsGetInfoParams>,
    traceId?: string,
  ): Promise<Exchange> {
    // `buildFunctionInfoPath` validates every caller-controlled segment
    // (domain, functionKey, workflowKey, instanceId) before splicing them in.
    const runtimePath = buildFunctionInfoPath({
      domain: params.domain,
      functionKey: params.functionKey,
      scope: params.scope,
      workflowKey: params.workflowKey,
      instanceId: params.instanceId,
    })
    return exchange(
      { method: 'GET', runtimePath, headers: params.headers, runtimeUrl: params.runtimeUrl },
      traceId,
    )
  }

  async function fetchContract(
    params: z.infer<typeof functionsFetchContractParams>,
    traceId?: string,
  ): Promise<Exchange> {
    const runtimePath = normalizeRuntimeHref(params.path)
    assertRuntimePath(runtimePath, 'FunctionRunService.fetchContract', traceId)
    return exchange(
      { method: 'GET', runtimePath, headers: params.headers, runtimeUrl: params.runtimeUrl },
      traceId,
    )
  }

  async function invoke(
    params: z.infer<typeof functionsInvokeParams>,
    traceId?: string,
  ): Promise<Exchange> {
    const normalizedHref = normalizeRuntimeHref(params.path)
    assertRuntimePath(normalizedHref, 'FunctionRunService.invoke', traceId)
    const { path: runtimePath, query: embeddedQuery } = splitEmbeddedQuery(normalizedHref)
    const sendsBody = params.verb === 'POST' || params.verb === 'PATCH'
    const headers = { ...(params.headers ?? {}) }
    if (sendsBody && params.contentType) {
      headers['content-type'] = params.contentType
    }
    // Explicit `query` params win over anything embedded in the href on key
    // collision — they are the more specific, caller-supplied input.
    const mergedQuery = { ...embeddedQuery, ...(params.query ?? {}) }
    const hasQuery = Object.keys(mergedQuery).length > 0
    return exchange(
      {
        method: params.verb,
        runtimePath,
        // A body-bearing verb still forwards a non-empty merged query (the
        // href may legitimately carry one); it just never carries `params.body`
        // in the query string the way GET/DELETE do.
        query: hasQuery ? mergedQuery : undefined,
        body: sendsBody ? params.body : undefined,
        headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
  }

  return { getInfo, fetchContract, invoke }
}

export type FunctionRunService = ReturnType<typeof createFunctionRunService>
