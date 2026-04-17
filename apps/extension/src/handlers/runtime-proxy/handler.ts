import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'

export interface RuntimeProxyRequest {
  method: string
  /** Path after /api/runtime, e.g. "/workflows/run" */
  runtimePath: string
  query?: Record<string, string>
  body?: string
  runtimeUrl?: string
  traceId?: string
}

export interface RuntimeProxyResponse {
  status: number
  contentType: string
  data: string
}

export async function proxyToRuntime(req: RuntimeProxyRequest): Promise<RuntimeProxyResponse> {
  const runtimeUrl = req.runtimeUrl ?? 'http://localhost:4201'
  const url = `${runtimeUrl}${req.runtimePath}`
  const queryString = req.query ? new URLSearchParams(req.query).toString() : ''
  const fullUrl = queryString ? `${url}?${queryString}` : url
  const method = req.method.toUpperCase()

  try {
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    const options: RequestInit = { method, headers: requestHeaders }

    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      options.body = req.body
    }

    const response = await fetch(fullUrl, options)
    const data = await response.text()

    return {
      status: response.status,
      contentType: response.headers.get('Content-Type') ?? 'application/json',
      data,
    }
  } catch (error) {
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_CONNECTION_FAILED,
      error instanceof Error ? error.message : 'Runtime connection failed',
      {
        source: 'runtimeProxyHandler.proxyToRuntime',
        layer: 'infrastructure',
        details: { runtimeUrl, fullUrl, method },
      },
      req.traceId,
    )
  }
}
