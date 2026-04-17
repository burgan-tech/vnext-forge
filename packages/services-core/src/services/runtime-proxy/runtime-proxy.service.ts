import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { z } from 'zod'

import type { LoggerAdapter, NetworkAdapter } from '../../adapters/index.js'

export interface RuntimeProxyServiceDeps {
  network: NetworkAdapter
  logger: LoggerAdapter
  defaultRuntimeUrl?: string
}

export const runtimeProxyParams = z.object({
  method: z.string().min(1),
  runtimePath: z.string().min(1),
  query: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  runtimeUrl: z.string().optional(),
})

export const runtimeProxyResult = z.object({
  status: z.number().int(),
  contentType: z.string(),
  data: z.string(),
})

export function createRuntimeProxyService(deps: RuntimeProxyServiceDeps) {
  const { network, defaultRuntimeUrl = 'http://localhost:4201' } = deps

  async function proxy(
    req: z.infer<typeof runtimeProxyParams>,
    traceId?: string,
  ): Promise<z.infer<typeof runtimeProxyResult>> {
    const runtimeUrl = req.runtimeUrl ?? defaultRuntimeUrl
    const url = `${runtimeUrl}${req.runtimePath}`
    const queryString = req.query ? new URLSearchParams(req.query).toString() : ''
    const fullUrl = queryString ? `${url}?${queryString}` : url
    const method = req.method.toUpperCase()

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const init: { method: string; headers: Record<string, string>; body?: string } = {
        method,
        headers,
      }
      if (method !== 'GET' && method !== 'HEAD' && req.body) {
        init.body = req.body
      }
      const response = await network.fetch(fullUrl, init)
      const data = await response.text()
      return {
        status: response.status,
        contentType: response.contentType ?? 'application/json',
        data,
      }
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_CONNECTION_FAILED,
        error instanceof Error ? error.message : 'Runtime connection failed',
        {
          source: 'RuntimeProxyService.proxy',
          layer: 'infrastructure',
          details: { runtimeUrl, fullUrl, method },
        },
        traceId,
      )
    }
  }

  return { proxy }
}

export type RuntimeProxyService = ReturnType<typeof createRuntimeProxyService>
