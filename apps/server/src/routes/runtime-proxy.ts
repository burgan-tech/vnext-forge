import { Hono } from 'hono'

export const runtimeProxyRoutes = new Hono()

// Proxy all requests to the vnext-runtime
runtimeProxyRoutes.all('/*', async (c) => {
  const runtimeUrl = c.req.header('X-Runtime-Url') || 'http://localhost:4201'
  const path = c.req.path.replace('/api/runtime', '')
  const url = `${runtimeUrl}${path}`
  const query = c.req.query()
  const queryString = new URLSearchParams(query).toString()
  const fullUrl = queryString ? `${url}?${queryString}` : url

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const method = c.req.method

    const options: RequestInit = { method, headers }
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        options.body = await c.req.text()
      } catch { /* no body */ }
    }

    const response = await fetch(fullUrl, options)
    const data = await response.text()

    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    })
  } catch (error) {
    return c.json({ error: `Runtime connection failed: ${error}` }, 502)
  }
})
