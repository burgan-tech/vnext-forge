import { describe, expect, it, vi } from 'vitest'

import {
  buildRuntimeProxyOutboundHeaders,
  createRuntimeProxyService,
  RUNTIME_PROXY_HOP_BY_HOP_HEADER_NAMES,
  type LoggerAdapter,
  type NetworkAdapter,
} from '../src/index.js'

const noopLogger: LoggerAdapter = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: () => noopLogger,
}

describe('buildRuntimeProxyOutboundHeaders (R-b4)', () => {
  it('strips hop-by-hop headers from caller-supplied headers', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'GET',
      callerHeaders: Object.fromEntries(
        RUNTIME_PROXY_HOP_BY_HOP_HEADER_NAMES.map((name) => [name, 'x']),
      ) as Record<string, string>,
    })
    for (const name of RUNTIME_PROXY_HOP_BY_HOP_HEADER_NAMES) {
      expect(headers[name]).toBeUndefined()
      expect(headers[name.toUpperCase()]).toBeUndefined()
    }
    expect(headers.Accept).toBe('application/json, text/plain, */*')
  })

  it('sets Content-Type only when there is a non-empty JSON body', () => {
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'GET', body: undefined }),
    ).not.toHaveProperty('Content-Type')
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'DELETE', body: '' }),
    ).not.toHaveProperty('Content-Type')
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'POST', body: '{}' }),
    ).toMatchObject({ 'Content-Type': 'application/json' })
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'GET', body: '{}' }),
    ).not.toHaveProperty('Content-Type')
  })

  it('forwards X-Trace-Id when traceId is supplied', () => {
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'GET', traceId: 'tid-1' }),
    ).toMatchObject({ 'X-Trace-Id': 'tid-1' })
    expect(
      buildRuntimeProxyOutboundHeaders({ method: 'GET' }),
    ).not.toHaveProperty('X-Trace-Id')
  })
})

describe('createRuntimeProxyService outbound headers (R-b4)', () => {
  it('passes merged headers to the network adapter', async () => {
    let seen: Record<string, string> | undefined
    const network: NetworkAdapter = {
      async fetch(_url, init) {
        seen = init?.headers
        return { status: 200, contentType: 'application/json', text: async () => '{}' }
      },
    }
    const proxy = createRuntimeProxyService({ network, logger: noopLogger })
    await proxy.proxy(
      {
        method: 'GET',
        runtimePath: '/health',
        headers: { 'X-Custom': 'a', connection: 'keep-alive' },
      },
      'rpc-trace',
    )
    expect(seen?.connection).toBeUndefined()
    expect(seen?.Connection).toBeUndefined()
    expect(seen?.['X-Custom']).toBe('a')
    expect(seen?.['X-Trace-Id']).toBe('rpc-trace')
  })
})
