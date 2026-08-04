import { ERROR_CODES } from '@vnext-forge-studio/app-contracts'
import { describe, expect, it, vi } from 'vitest'

import { createFunctionRunService } from '../src/index.js'

function serviceWith(response: {
  status: number; contentType?: string; data: string; responseHeaders?: Record<string, string>
}) {
  const proxy = vi.fn().mockResolvedValue({
    status: response.status,
    contentType: response.contentType ?? 'application/json',
    data: response.data,
    responseHeaders: response.responseHeaders ?? {},
  })
  return { service: createFunctionRunService({ proxy } as never), proxy }
}

describe('functionRunService.getInfo', () => {
  it('builds the domain path and returns the parsed exchange', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"key":"get-branches"}' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'get-branches', scope: 'D' })

    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', runtimePath: '/api/v1/core/functions/get-branches/info' }),
      undefined,
    )
    expect(result.status).toBe(200)
    expect(result.json).toEqual({ key: 'get-branches' })
  })

  it('RETURNS a 403 instead of throwing', async () => {
    // The whole point of this service: an authorization refusal is data the
    // runner renders, not an exception that hides the status.
    const { service } = serviceWith({ status: 403, data: '{"detail":"forbidden"}' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.status).toBe(403)
    expect(result.json).toEqual({ detail: 'forbidden' })
  })

  it('returns a 500 with a non-JSON body and no json field', async () => {
    const { service } = serviceWith({ status: 500, contentType: 'text/plain', data: 'boom' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.status).toBe(500)
    expect(result.body).toBe('boom')
    expect(result.json).toBeUndefined()
  })

  it('surfaces response headers', async () => {
    const { service } = serviceWith({
      status: 200, data: '{}', responseHeaders: { 'x-trace-id': 't-1' },
    })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.responseHeaders).toEqual({ 'x-trace-id': 't-1' })
  })

  it('records a jsonParseError instead of silently dropping a malformed JSON body', async () => {
    const { service } = serviceWith({ status: 200, contentType: 'application/json', data: '{not valid json' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.json).toBeUndefined()
    expect(result.jsonParseError).toBeTruthy()
    expect(result.body).toBe('{not valid json')
  })

  it('rejects a functionKey attempting path traversal before ever calling the proxy', async () => {
    // Regression: this used to build
    // "/api/v1/core/functions/../../../../actuator/env/info" and proxy it.
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(
      service.getInfo({ domain: 'core', functionKey: '../../../../actuator/env', scope: 'D' }),
    ).rejects.toThrow(/functionKey/)
    expect(proxy).not.toHaveBeenCalled()
  })
})

describe('functionRunService.fetchContract', () => {
  it('proxies a valid href, normalized under /api/v1', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"type":"view"}' })
    await service.fetchContract({ path: '/core/functions/f/view?target=input' })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET', runtimePath: '/api/v1/core/functions/f/view?target=input',
      }),
      undefined,
    )
  })

  it('leaves an href that already carries /api/v1 unchanged', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await service.fetchContract({ path: '/api/v1/core/functions/f/view?target=input' })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET', runtimePath: '/api/v1/core/functions/f/view?target=input',
      }),
      undefined,
    )
  })

  it('rejects an href that is not a runtime function path', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(service.fetchContract({ path: 'https://evil.test/x' })).rejects.toThrow(/path/i)
    expect(proxy).not.toHaveBeenCalled()
  })

  it('rejects with API_BAD_REQUEST, not API_FORBIDDEN', async () => {
    // API_FORBIDDEN maps to recovery: 'contact-support' and toUserMessage()
    // strips `details` — a user whose legitimate href tripped this guard
    // (e.g. an unanticipated character) would get "contact support" with no
    // way to self-correct. Nothing currently pins the code, so reverting
    // this half of the fix would keep the suite green.
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(
      service.fetchContract({ path: 'https://evil.test/x' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.API_BAD_REQUEST })
    expect(proxy).not.toHaveBeenCalled()
  })

  it('never reaches the proxy for the query-smuggling bypass string', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(
      service.fetchContract({ path: '/core/workflows/w/instances/i?x=/functions/y' }),
    ).rejects.toThrow()
    expect(proxy).not.toHaveBeenCalled()
  })

  it('threads traceId into the rejection so a legitimate href failure stays correlatable', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(
      service.fetchContract({ path: 'https://evil.test/x' }, 'trace-abc'),
    ).rejects.toMatchObject({ traceId: 'trace-abc' })
    expect(proxy).not.toHaveBeenCalled()
  })
})

describe('functionRunService.invoke', () => {
  it('sends a body and content type for POST, with the path normalized under /api/v1', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"ok":true}' })
    await service.invoke({
      path: '/core/functions/f', verb: 'POST',
      body: 'a=1', contentType: 'application/x-www-form-urlencoded',
      headers: { authorization: 'Bearer t' },
    })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST', runtimePath: '/api/v1/core/functions/f', body: 'a=1',
        headers: { authorization: 'Bearer t', 'content-type': 'application/x-www-form-urlencoded' },
      }),
      undefined,
    )
  })

  it('sends a query and no body for GET', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '[]' })
    await service.invoke({ path: '/core/functions/f', verb: 'GET', query: { page: '1' } })
    const call = proxy.mock.calls[0]![0]
    expect(call.query).toEqual({ page: '1' })
    expect(call.body).toBeUndefined()
  })

  it('returns a 422 from the function as data', async () => {
    const { service } = serviceWith({ status: 422, data: '{"errors":{"a":["required"]}}' })
    const result = await service.invoke({ path: '/core/functions/f', verb: 'POST' })
    expect(result.status).toBe(422)
    expect(result.json).toEqual({ errors: { a: ['required'] } })
  })

  it('merges a query embedded in the href with an explicit query instead of concatenating a second "?"', async () => {
    // Regression: runtime-proxy appends `query` unconditionally, so a
    // runtimePath of ".../view?target=input" plus a `query` of { page: '1' }
    // used to produce ".../view?target=input?page=1", silently corrupting
    // `target` into the string "input?page=1".
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await service.invoke({
      path: '/core/functions/f/view?target=input', verb: 'GET', query: { page: '1' },
    })
    const call = proxy.mock.calls[0]![0]
    expect(call.runtimePath).toBe('/api/v1/core/functions/f/view')
    expect(call.runtimePath).not.toContain('?')
    expect(call.query).toEqual({ target: 'input', page: '1' })
  })

  it('lets an explicit query win over an embedded one on key collision', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await service.invoke({ path: '/core/functions/f?target=old', verb: 'GET', query: { target: 'new' } })
    const call = proxy.mock.calls[0]![0]
    expect(call.query).toEqual({ target: 'new' })
  })

  it('rejects the query-smuggling bypass string before ever calling the proxy', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(
      service.invoke({ path: '/core/workflows/w/instances/i?x=/functions/y', verb: 'GET' }),
    ).rejects.toThrow()
    expect(proxy).not.toHaveBeenCalled()
  })
})
