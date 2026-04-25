import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'

import { bodyLimitMiddleware } from '../shared/middleware/body-limit.js'
import { errorHandler } from '../shared/middleware/error-handler.js'
import { traceIdMiddleware } from '../shared/middleware/trace-id.js'
import { ok } from '../shared/lib/response-helpers.js'
import type { Variables } from '../shared/types/hono.js'

// Note: bodyLimitMiddleware reads `config.maxRequestBodyBytes` at call time
// from the singleton, so the tests assert against the production default
// (1 MiB). Increasing the limit in `apps/server/.env` does not affect this
// suite because the test process starts without an env file.

function buildApp() {
  const app = new Hono<{ Variables: Variables }>()
    .use('*', traceIdMiddleware)
    .use('*', bodyLimitMiddleware)
    .post('/echo', async (c) => ok(c, { received: true }))
  app.onError(errorHandler)
  return app
}

describe('bodyLimitMiddleware', () => {
  it('accepts a small payload', async () => {
    const app = buildApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '32',
      },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects when Content-Length advertises more than the configured limit', async () => {
    const app = buildApp()
    const oversize = String(2 * 1024 * 1024) // 2 MiB > 1 MiB default
    const res = await app.request('/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': oversize,
      },
      body: '{}',
    })
    expect(res.status).toBe(413)
    const json = (await res.json()) as { success: boolean; error: { code: string } }
    expect(json.success).toBe(false)
    expect(json.error.code).toBe(ERROR_CODES.API_PAYLOAD_TOO_LARGE)
  })

  it('passes through when Content-Length header is absent', async () => {
    const app = buildApp()
    // Hono test client `app.request` sets Content-Length when given a body
    // with a known size; we explicitly omit it to mimic chunked transfer.
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
  })

  it('formats the error envelope with traceId', async () => {
    const app = buildApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(10 * 1024 * 1024),
      },
      body: '{}',
    })
    const traceId = res.headers.get('X-Trace-Id')
    expect(traceId).toBeTruthy()
    const json = (await res.json()) as { error: { traceId?: string } }
    expect(json.error.traceId).toBe(traceId)
  })

  it('error class round-trips with the expected code', () => {
    // Belt-and-braces sanity check that the new error code reaches the
    // contract package without typos.
    const err = new VnextForgeError(ERROR_CODES.API_PAYLOAD_TOO_LARGE, 'too big', {
      source: 'test',
      layer: 'transport',
    })
    expect(err.toFailure().error.code).toBe(ERROR_CODES.API_PAYLOAD_TOO_LARGE)
  })
})
