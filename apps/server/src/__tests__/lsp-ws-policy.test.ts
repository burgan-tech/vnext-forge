import { describe, expect, it } from 'vitest'

import {
  assertLspConnectionCapacityOk,
  assertLspInboundMessageSizeOk,
  assertLspWebSocketOriginAllowed,
} from '../lsp/lsp-ws-policy.js'

describe('lsp-ws-policy (R-b16)', () => {
  it('is permissive for Origin when the server binds on loopback', () => {
    expect(
      assertLspWebSocketOriginAllowed('127.0.0.1', 'http://any.example', []).ok,
    ).toBe(true)
    expect(
      assertLspWebSocketOriginAllowed('localhost', 'http://evil.test', []).ok,
    ).toBe(true)
  })

  it('requires allowlisted Origin when not bound on loopback', () => {
    expect(
      assertLspWebSocketOriginAllowed('0.0.0.0', 'http://a.test', [
        'http://a.test',
      ]).ok,
    ).toBe(true)
    expect(
      assertLspWebSocketOriginAllowed('0.0.0.0', 'http://b.test', [
        'http://a.test',
      ]),
    ).toEqual({ ok: false, code: 'LSP_WS_ORIGIN_REJECTED' })
    expect(assertLspWebSocketOriginAllowed('0.0.0.0', undefined, []).ok).toBe(
      true,
    )
  })

  it('rejects oversize inbound messages', () => {
    expect(assertLspInboundMessageSizeOk(100, 100).ok).toBe(true)
    expect(assertLspInboundMessageSizeOk(101, 100)).toEqual({
      ok: false,
      code: 'LSP_WS_MESSAGE_OVERSIZE',
    })
  })

  it('rejects new connections when at capacity', () => {
    expect(assertLspConnectionCapacityOk(0, 8).ok).toBe(true)
    expect(assertLspConnectionCapacityOk(7, 8).ok).toBe(true)
    expect(assertLspConnectionCapacityOk(8, 8)).toEqual({
      ok: false,
      code: 'LSP_WS_MAX_CONNECTIONS',
    })
  })
})
