import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import { errorHandler } from '../shared/middleware/error-handler.js'
import { traceIdMiddleware } from '../shared/middleware/trace-id.js'
import { requestLoggerMiddleware } from '../shared/middleware/logger.js'
import { ok } from '../shared/lib/response-helpers.js'
import type { Variables } from '../shared/types/hono.js'

/**
 * R-b19 contract test — every error path the server can reach (Zod
 * validation failure, typed `VnextForgeError`, unexpected `Error`) must
 * surface as an `ApiResponse` failure envelope:
 *
 *   {
 *     success: false,
 *     data: null,
 *     error: { code, message, traceId? },
 *   }
 *
 * with `Content-Type: application/json` and a status code consistent with
 * the canonical mapping in `error-handler.ts`. The web HttpTransport relies
 * on this contract to skip its own status-to-code fallback.
 */

interface FailureEnvelope {
  success: boolean
  data: null
  error: { code: string; message: string; traceId?: string }
}

function buildApp(routes: (app: Hono<{ Variables: Variables }>) => void) {
  const app = new Hono<{ Variables: Variables }>()
    .use('*', traceIdMiddleware)
    .use('*', requestLoggerMiddleware)
  routes(app)
  app.onError(errorHandler)
  return app
}

describe('errorHandler ApiResponse contract', () => {
  it('formats VnextForgeError as a failure envelope with the correct status', async () => {
    const app = buildApp((a) => {
      a.get('/boom', async () => {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          'nope',
          { source: 'test', layer: 'application' },
        )
      })
    })
    const res = await app.request('/boom')
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    const json = (await res.json()) as FailureEnvelope
    expect(json.success).toBe(false)
    expect(json.data).toBeNull()
    expect(json.error.code).toBe(ERROR_CODES.API_FORBIDDEN)
    // toFailure() uses USER_MESSAGES (sanitized copy), never the raw
    // developer message — this is the contract HttpTransport relies on.
    expect(typeof json.error.message).toBe('string')
    expect(json.error.message.length).toBeGreaterThan(0)
    expect(json.error.message).not.toBe('nope')
    expect(json.error.traceId).toBe(res.headers.get('X-Trace-Id'))
  })

  it('formats ZodError as 400 + API_BAD_REQUEST', async () => {
    const schema = z.object({ name: z.string() })
    const app = buildApp((a) => {
      a.get('/zod', async () => {
        schema.parse({ name: 123 })
        return new Response('unreachable')
      })
    })
    const res = await app.request('/zod')
    expect(res.status).toBe(400)
    const json = (await res.json()) as FailureEnvelope
    expect(json.success).toBe(false)
    expect(json.error.code).toBe(ERROR_CODES.API_BAD_REQUEST)
  })

  it('does not propagate raw value information from Zod issues', async () => {
    // Build a ZodError whose issue refers to a "secret-shaped" payload to
    // verify the issue-sanitization in the error path. The error-handler
    // forwards the raw issues today; this test guards the public contract:
    // every issue surfaced must contain only path/message/code.
    const schema = z.object({ token: z.string() })
    const app = buildApp((a) => {
      a.post('/zod-body', async (c) => {
        const body = await c.req.json()
        schema.parse(body)
        return c.json({ ok: true })
      })
    })
    const res = await app.request('/zod-body', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 12345 }),
    })
    const json = (await res.json()) as FailureEnvelope & {
      error: { details?: unknown }
    }
    expect(json.success).toBe(false)
    // `details` is optional; if present it must not echo back the rejected value.
    const serialized = JSON.stringify(json)
    expect(serialized).not.toContain('12345')
  })

  it('falls back to INTERNAL_UNEXPECTED for non-VnextForge errors', async () => {
    const app = buildApp((a) => {
      a.get('/oops', async () => {
        throw new Error('unhandled')
      })
    })
    const res = await app.request('/oops')
    expect(res.status).toBe(500)
    const json = (await res.json()) as FailureEnvelope
    expect(json.success).toBe(false)
    expect(json.error.code).toBe(ERROR_CODES.INTERNAL_UNEXPECTED)
    expect(json.error.traceId).toBe(res.headers.get('X-Trace-Id'))
  })

  describe('runtime error details (ADR 005 addendum)', () => {
    function throwing(error: VnextForgeError) {
      return buildApp((a) => {
        a.get('/runtime', async () => {
          throw error
        })
      })
    }

    async function detailsOf(error: VnextForgeError) {
      const res = await throwing(error).request('/runtime')
      const json = (await res.json()) as FailureEnvelope & {
        error: { details?: Record<string, unknown> }
      }
      return { res, json }
    }

    it('forwards the runtime answer of a non-2xx runtime response', async () => {
      const { res, json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.RUNTIME_NOT_FOUND, 'Runtime returned HTTP 404', {
          source: 'QuickRunService.downloadFile',
          layer: 'infrastructure',
          details: {
            httpStatus: 404,
            error: {
              prefix: 'Instance',
              code: '100049',
              message: 'File not found in instance data.',
              target: 'file',
              validationErrors: [{ message: 'Unknown file id.', members: ['file'], stackTrace: 'at X.Y()' }],
              stackTrace: 'at Vnext.Runtime.Files.Get()',
              innerError: { message: 'inner' },
            },
          },
        }),
      )
      expect(res.status).toBe(404)
      expect(json.error.code).toBe(ERROR_CODES.RUNTIME_NOT_FOUND)
      expect(json.error.details).toEqual({
        httpStatus: 404,
        error: {
          prefix: 'Instance',
          code: '100049',
          message: 'File not found in instance data.',
          target: 'file',
          validationErrors: [{ message: 'Unknown file id.', members: ['file'] }],
        },
      })
    })

    it('forwards flat and RFC 7807 runtime bodies without unknown keys', async () => {
      const { json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.RUNTIME_EXECUTION_FAILED, 'Runtime returned HTTP 400', {
          source: 'QuickRunService.listInstances',
          layer: 'infrastructure',
          details: {
            httpStatus: 400,
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: { filter: ['filter.unknownOperator'], sort: 'sort.invalidJson' },
            exception: 'System.InvalidOperationException: boom',
          },
        }),
      )
      expect(json.error.details).toEqual({
        httpStatus: 400,
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { filter: ['filter.unknownOperator'], sort: 'sort.invalidJson' },
      })
    })

    it('caps long strings and long lists', async () => {
      const { json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.RUNTIME_EXECUTION_FAILED, 'Runtime returned HTTP 400', {
          source: 'test',
          layer: 'infrastructure',
          details: {
            httpStatus: 400,
            message: 'x'.repeat(5000),
            errors: Array.from({ length: 200 }, (_, i) => ({ code: `c${i}`, message: 'm' })),
          },
        }),
      )
      const details = json.error.details as { message: string; errors: unknown[] }
      expect(details.message).toHaveLength(1000)
      expect(details.errors).toHaveLength(50)
    })

    it('never forwards forge-internal runtime details', async () => {
      const { json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.RUNTIME_CONNECTION_FAILED, 'connect ECONNREFUSED', {
          source: 'RuntimeProxyService.proxy',
          layer: 'infrastructure',
          details: { runtimeUrl: 'http://localhost:4201', fullUrl: 'http://localhost:4201/x?y=1', method: 'GET' },
        }),
      )
      expect(json.error.details).toBeUndefined()
      expect(JSON.stringify(json)).not.toContain('localhost:4201')
    })

    it('ignores RUNTIME_EXECUTION_FAILED details that are not a runtime answer', async () => {
      const { json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.RUNTIME_EXECUTION_FAILED, 'boom', {
          source: 'test',
          layer: 'infrastructure',
          details: { message: 'internal', path: '/Users/dev/project/file.json' },
        }),
      )
      expect(json.error.details).toBeUndefined()
    })

    it('keeps details of non-runtime codes server-side', async () => {
      const { json } = await detailsOf(
        new VnextForgeError(ERROR_CODES.FILE_NOT_FOUND, 'missing', {
          source: 'FileService.read',
          layer: 'infrastructure',
          details: { httpStatus: 404, path: '/Users/dev/secret.json' },
        }),
      )
      expect(json.error.details).toBeUndefined()
      expect(JSON.stringify(json)).not.toContain('/Users/dev')
    })
  })

  it('happy-path responses use the success envelope', async () => {
    const app = buildApp((a) => {
      a.get('/ok', (c) => ok(c, { hello: 'world' }))
    })
    const res = await app.request('/ok')
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: unknown
      error: null
    }
    expect(json.success).toBe(true)
    expect(json.error).toBeNull()
    expect(json.data).toEqual({ hello: 'world' })
  })

})
