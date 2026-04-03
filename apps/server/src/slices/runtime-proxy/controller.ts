import type { Context } from 'hono'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { getRequestLogger } from '@shared/lib/logger.js'
import { parseRequest } from '@shared/lib/request.js'
import { runtimeProxyRequestSchema } from './schema.js'

export const runtimeProxyController = {
  async proxy(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'runtimeProxyController.proxy')
    const { headers } = await parseRequest(
      c,
      runtimeProxyRequestSchema,
      'runtimeProxyController.proxy',
    )
    const runtimeUrl = headers['x-runtime-url'] ?? 'http://localhost:4201'
    const runtimePath = c.req.path.replace('/api/runtime', '')
    const url = `${runtimeUrl}${runtimePath}`
    const queryString = new URLSearchParams(c.req.query()).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url
    const method = c.req.method

    try {
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      const options: RequestInit = { method, headers: requestHeaders }

      logger.info({ runtimeUrl, runtimePath, fullUrl, method }, 'proxying runtime request')

      if (method !== 'GET' && method !== 'HEAD') {
        const body = await c.req.text()
        if (body) {
          options.body = body
        }
      }

      const response = await fetch(fullUrl, options)
      const data = await response.text()

      logger.info(
        { runtimeUrl, runtimePath, fullUrl, method, status: response.status },
        'runtime response received',
      )

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
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
