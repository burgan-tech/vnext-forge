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

  it('always includes User-Agent identifying vnext-forge-studio', () => {
    const headers = buildRuntimeProxyOutboundHeaders({ method: 'GET' })
    expect(headers['User-Agent']).toBe('vnext-forge-studio/0.1.0')
  })

  it('allows caller-supplied User-Agent to override the default', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'GET',
      callerHeaders: { 'User-Agent': 'custom-agent/1.0' },
    })
    expect(headers['User-Agent']).toBe('custom-agent/1.0')
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

describe('buildRuntimeProxyOutboundHeaders — request Content-Type (R-b4)', () => {
  it('defaults to application/json for a body-bearing verb', () => {
    const headers = buildRuntimeProxyOutboundHeaders({ method: 'POST', body: '{"a":1}' })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('honours an allowlisted caller Content-Type', () => {
    // Functions accept form-urlencoded; the Quick Runner must be able to send it.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: 'a=1&b=2',
      callerHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('matches the allowlist case-insensitively and ignores parameters', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: 'a=1',
      callerHeaders: { 'content-type': 'Application/X-WWW-Form-Urlencoded; charset=UTF-8' },
    })
    expect(headers['Content-Type']).toBe('Application/X-WWW-Form-Urlencoded; charset=UTF-8')
  })

  it('falls back to JSON for a content type that is not allowlisted', () => {
    // Conservative default: this is a shared, security-relevant module.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: '<xml/>',
      callerHeaders: { 'Content-Type': 'application/xml' },
    })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('never sets Content-Type on a verb that sends no body', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'GET',
      callerHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('falls back to JSON when the parameters are not a well-formed charset', () => {
    // The allowlist is a safety boundary on the proxy: a caller must not be able
    // to smuggle arbitrary text into an outbound header value.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: '{}',
      callerHeaders: { 'Content-Type': 'application/json;x=\r\nX-Evil: 1' },
    })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('leaves exactly one Content-Type key regardless of the caller’s casing', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: 'a=1',
      callerHeaders: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(Object.keys(headers).filter((k) => k.toLowerCase() === 'content-type')).toHaveLength(1)
  })

  it('drops a caller Content-Type on a bodyless POST', () => {
    // The one behaviour change this commit makes for existing callers: previously
    // such a header was forwarded, now it is dropped.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      callerHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(headers['Content-Type']).toBeUndefined()
  })
})
