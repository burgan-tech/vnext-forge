import type { Context } from 'hono'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { parseRequest } from '@lib/request.js'
import { runtimeProxyRequestSchema } from './schema.js'

export interface RuntimeProxyController {
  proxy(c: Context): Promise<Response>
}

export const runtimeProxyController: RuntimeProxyController = {
  async proxy(c) {
    const { headers } = await parseRequest(
      c,
      runtimeProxyRequestSchema,
      'runtimeProxyController.proxy',
    )
    const runtimeUrl = headers['x-runtime-url'] || 'http://localhost:4201'
    const runtimePath = c.req.path.replace('/api/runtime', '')
    const url = `${runtimeUrl}${runtimePath}`
    const queryString = new URLSearchParams(c.req.query()).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    try {
      const method = c.req.method
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      const options: RequestInit = { method, headers: requestHeaders }

      if (method !== 'GET' && method !== 'HEAD') {
        const body = await c.req.text()
        if (body) {
          options.body = body
        }
      }

      const response = await fetch(fullUrl, options)
      const data = await response.text()

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      })
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_CONNECTION_FAILED,
        error instanceof Error ? error.message : 'Runtime connection failed',
        {
          source: 'runtimeProxyController.proxy',
          layer: 'infrastructure',
          details: { runtimeUrl, fullUrl, method: c.req.method },
        },
        c.get('traceId'),
      )
    }
  },
}
