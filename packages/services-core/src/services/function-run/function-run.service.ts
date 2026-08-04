import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type { RuntimeProxyService } from '../runtime-proxy/runtime-proxy.service.js'
import { buildFunctionInfoPath, isValidRuntimePath } from './function-run-paths.js'
import {
  functionsFetchContractParams,
  functionsGetInfoParams,
  functionsInvokeParams,
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
  // Parse only when the engine says JSON. A parse failure is not an error —
  // the raw body is still shown, which is exactly what the runner needs when
  // a function returns a malformed payload.
  if (result.contentType.toLowerCase().includes('json') && result.data.length > 0) {
    try {
      exchange.json = JSON.parse(result.data)
    } catch {
      /* leave `json` unset; `body` carries the raw text */
    }
  }
  return exchange
}

function assertRuntimePath(path: string, source: string): void {
  if (isValidRuntimePath(path)) return
  throw new VnextForgeError(
    ERROR_CODES.API_FORBIDDEN,
    'Refusing to proxy a path that is not a runtime function route.',
    { source, layer: 'domain', details: { path } },
  )
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
    assertRuntimePath(params.path, 'FunctionRunService.fetchContract')
    return exchange(
      { method: 'GET', runtimePath: params.path, headers: params.headers, runtimeUrl: params.runtimeUrl },
      traceId,
    )
  }

  async function invoke(
    params: z.infer<typeof functionsInvokeParams>,
    traceId?: string,
  ): Promise<Exchange> {
    assertRuntimePath(params.path, 'FunctionRunService.invoke')
    const sendsBody = params.verb === 'POST' || params.verb === 'PATCH'
    const headers = { ...(params.headers ?? {}) }
    if (sendsBody && params.contentType) {
      headers['content-type'] = params.contentType
    }
    return exchange(
      {
        method: params.verb,
        runtimePath: params.path,
        query: sendsBody ? undefined : params.query,
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
