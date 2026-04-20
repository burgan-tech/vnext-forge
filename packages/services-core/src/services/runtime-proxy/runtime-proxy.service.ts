import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { z } from 'zod'

import type { LoggerAdapter, NetworkAdapter } from '../../adapters/index.js'

export interface RuntimeProxyServiceDeps {
  network: NetworkAdapter
  logger: LoggerAdapter
  defaultRuntimeUrl?: string
  /**
   * Extra runtime base URLs that may be targeted via `req.runtimeUrl`. The
   * `defaultRuntimeUrl` is implicitly always allowed; this list extends it.
   * If `allowRuntimeUrlOverride` is `false`, this list is ignored — only
   * the default is reachable.
   */
  allowedBaseUrls?: readonly string[]
  /**
   * When `false` (the default), the `runtimeUrl` parameter on
   * `runtime.proxy` is rejected and every request goes to
   * `defaultRuntimeUrl`. This is the SSRF-safe configuration.
   *
   * Set to `true` only when you intentionally want callers to choose
   * which allow-listed runtime to talk to (e.g. a multi-runtime designer
   * desktop). Even then the candidate must appear in `allowedBaseUrls` or
   * equal `defaultRuntimeUrl`.
   */
  allowRuntimeUrlOverride?: boolean
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
  const {
    network,
    defaultRuntimeUrl = 'http://localhost:4201',
    allowedBaseUrls = [],
    allowRuntimeUrlOverride = false,
  } = deps

  // Normalize once at construction so per-request matching is a cheap
  // string compare. Trailing slashes are dropped because `${base}${path}`
  // joins them anyway.
  const normalize = (u: string) => u.trim().replace(/\/+$/, '')
  const allowed = new Set<string>([
    normalize(defaultRuntimeUrl),
    ...allowedBaseUrls.map(normalize),
  ])

  async function proxy(
    req: z.infer<typeof runtimeProxyParams>,
    traceId?: string,
  ): Promise<z.infer<typeof runtimeProxyResult>> {
    let runtimeUrl: string
    if (req.runtimeUrl) {
      if (!allowRuntimeUrlOverride) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          'runtimeUrl override is disabled on this server. ' +
            'Set ALLOW_RUNTIME_URL_OVERRIDE=true and add the URL to ' +
            'RUNTIME_ALLOWED_BASE_URLS to enable it.',
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: { attemptedRuntimeUrl: req.runtimeUrl },
          },
          traceId,
        )
      }
      const candidate = normalize(req.runtimeUrl)
      if (!allowed.has(candidate)) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          `runtimeUrl ${req.runtimeUrl} is not in the allow-list.`,
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: {
              attemptedRuntimeUrl: req.runtimeUrl,
              allowedBaseUrls: [...allowed],
            },
          },
          traceId,
        )
      }
      runtimeUrl = candidate
    } else {
      runtimeUrl = normalize(defaultRuntimeUrl)
    }
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
