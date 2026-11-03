import { describe, expect, it } from 'vitest'

import { createRuntimeProxyService } from '../src/services/runtime-proxy/runtime-proxy.service.js'

const bytes = new Uint8Array([0, 255, 1, 128, 37])

function network(status: number) {
  return {
    fetch: async () => ({
      status,
      contentType: status === 200 ? 'image/png' : 'application/json',
      headers: {},
      text: async () => (status === 200 ? new TextDecoder().decode(bytes) : '{"error":{"code":"100049"}}'),
      arrayBuffer: async () => bytes.buffer,
    }),
  }
}

describe('runtime proxy binary mode', () => {
  it('returns the body base64-encoded so bytes survive', async () => {
    const service = createRuntimeProxyService({ network: network(200) } as never)
    const result = await service.proxy({ method: 'GET', runtimePath: '/x' }, undefined, { binary: true })
    expect(Buffer.from(result.data, 'base64')).toEqual(Buffer.from(bytes))
    expect(result.contentType).toBe('image/png')
  })

  it('keeps error bodies as text so they can be parsed', async () => {
    const service = createRuntimeProxyService({ network: network(404) } as never)
    const result = await service.proxy({ method: 'GET', runtimePath: '/x' }, undefined, { binary: true })
    expect(result.data).toContain('100049')
  })
})

describe('runtime proxy raw request body', () => {
  function capture() {
    const calls: { headers: Record<string, string>; body?: unknown }[] = []
    return {
      calls,
      network: {
        fetch: async (_url: string, init: { headers: Record<string, string>; body?: unknown }) => {
          calls.push(init)
          return { status: 201, contentType: 'application/json', headers: {}, text: async () => '{"file":"t"}' }
        },
      },
    }
  }

  it('sends the bytes with the file media type', async () => {
    const { calls, network } = capture()
    const service = createRuntimeProxyService({ network } as never)
    await service.proxy({ method: 'POST', runtimePath: '/files' }, undefined, {
      rawBody: { bytes, contentType: 'image/tiff' },
    })
    expect(calls[0]!.body).toBe(bytes)
    expect(calls[0]!.headers['Content-Type']).toBe('image/tiff')
  })

  it('falls back to application/octet-stream for a media type that could smuggle a header', async () => {
    const { calls, network } = capture()
    const service = createRuntimeProxyService({ network } as never)
    for (const contentType of ['text/plain\r\nX-Evil: 1', 'text/plain; charset=utf-8', 'nonsense', undefined]) {
      await service.proxy({ method: 'POST', runtimePath: '/files' }, undefined, { rawBody: { bytes, contentType } })
    }
    expect(calls.map((c) => c.headers['Content-Type'])).toEqual(Array(4).fill('application/octet-stream'))
  })
})
