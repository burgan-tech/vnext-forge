import { isLoopbackHost } from '@vnext-forge/app-contracts'

/**
 * Pure policy helpers for the LSP WebSocket upgrade and inbound frames (R-b16).
 */

export function assertLspWebSocketOriginAllowed(
  bindHost: string,
  requestOrigin: string | undefined,
  corsAllowedOrigins: readonly string[],
): { ok: true } | { ok: false; code: 'LSP_WS_ORIGIN_REJECTED' } {
  if (!requestOrigin) {
    return { ok: true }
  }
  if (isLoopbackHost(bindHost)) {
    return { ok: true }
  }
  if (corsAllowedOrigins.includes(requestOrigin)) {
    return { ok: true }
  }
  return { ok: false, code: 'LSP_WS_ORIGIN_REJECTED' }
}

export function assertLspInboundMessageSizeOk(
  byteLength: number,
  maxBytes: number,
): { ok: true } | { ok: false; code: 'LSP_WS_MESSAGE_OVERSIZE' } {
  if (byteLength <= maxBytes) {
    return { ok: true }
  }
  return { ok: false, code: 'LSP_WS_MESSAGE_OVERSIZE' }
}

export function assertLspConnectionCapacityOk(
  activeConnections: number,
  maxConnections: number,
): { ok: true } | { ok: false; code: 'LSP_WS_MAX_CONNECTIONS' } {
  if (activeConnections < maxConnections) {
    return { ok: true }
  }
  return { ok: false, code: 'LSP_WS_MAX_CONNECTIONS' }
}
