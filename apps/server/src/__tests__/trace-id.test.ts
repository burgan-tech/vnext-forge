import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'

import { traceIdMiddleware } from '../shared/middleware/trace-id.js'
import { ok } from '../shared/lib/response-helpers.js'
import type { Variables } from '../shared/types/hono.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('traceIdMiddleware (R-b11)', () => {
  it('generates a trace id and echoes it on X-Trace-Id when none was sent', async () => {
    const app = new Hono<{ Variables: Variables }>()
      .use('*', traceIdMiddleware)
      .get('/t', (c) => ok(c, { traceId: c.get('traceId') }))

    const res = await app.request('http://localhost/t')
    const header = res.headers.get('X-Trace-Id')
    expect(header).toBeTruthy()
    expect(header).toMatch(UUID_RE)
    const body = (await res.json()) as { data: { traceId: string } }
    expect(body.data.traceId).toBe(header)
  })

  it('does not adopt inbound traceparent as the request traceId', async () => {
    const linked =
      '4bf92f3577b34da6a3ce929d0e0e4736' as const
    const traceparent = `00-${linked}-00f067aa0ba902b7-01`

    const app = new Hono<{ Variables: Variables }>()
      .use('*', traceIdMiddleware)
      .get('/t', (c) =>
        ok(c, {
          traceId: c.get('traceId'),
          linkedTraceId: c.get('linkedTraceId'),
        }),
      )

    const res = await app.request('http://localhost/t', {
      headers: { traceparent },
    })
    const xTrace = res.headers.get('X-Trace-Id')
    expect(xTrace).toBeTruthy()
    expect(xTrace).toMatch(UUID_RE)
    expect(xTrace?.replace(/-/g, '').toLowerCase()).not.toBe(linked)

    const body = (await res.json()) as {
      data: { traceId: string; linkedTraceId?: string }
    }
    expect(body.data.linkedTraceId).toBe(linked)
    expect(body.data.traceId).toBe(xTrace)
  })

  it('always sets X-Trace-Id even when the handler throws', async () => {
    const app = new Hono<{ Variables: Variables }>()
      .use('*', traceIdMiddleware)
      .get('/boom', () => {
        throw new Error('fail')
      })
    app.onError(() => new Response('Internal', { status: 500 }))

    const res = await app.request('http://localhost/boom')
    expect(res.headers.get('X-Trace-Id')).toMatch(UUID_RE)
  })
})
