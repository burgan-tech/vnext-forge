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
