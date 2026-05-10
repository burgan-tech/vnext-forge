import { isLoopbackHost } from '@vnext-forge-studio/app-contracts';

/**
 * Pure policy helpers for the integrated terminal WebSocket upgrade and
 * inbound frames. Mirrors `lsp-ws-policy.ts` — same pattern, different limits.
 *
 * The terminal WS sees user keystrokes and pty output; messages are short
 * (≤ a few KB) so a per-message size cap keeps a misbehaving renderer from
 * pushing arbitrary buffers at the host process.
 */

export function assertPtyWebSocketOriginAllowed(
  bindHost: string,
  requestOrigin: string | undefined,
  corsAllowedOrigins: readonly string[],
): { ok: true } | { ok: false; code: 'PTY_WS_ORIGIN_REJECTED' } {
  if (!requestOrigin) {
    return { ok: true };
  }
  if (isLoopbackHost(bindHost)) {
    return { ok: true };
  }
  if (corsAllowedOrigins.includes(requestOrigin)) {
    return { ok: true };
  }
  return { ok: false, code: 'PTY_WS_ORIGIN_REJECTED' };
}

export function assertPtyInboundMessageSizeOk(
  byteLength: number,
  maxBytes: number,
): { ok: true } | { ok: false; code: 'PTY_WS_MESSAGE_OVERSIZE' } {
  if (byteLength <= maxBytes) {
    return { ok: true };
  }
  return { ok: false, code: 'PTY_WS_MESSAGE_OVERSIZE' };
}

export function assertPtyConnectionCapacityOk(
  activeConnections: number,
  maxConnections: number,
): { ok: true } | { ok: false; code: 'PTY_WS_MAX_CONNECTIONS' } {
  if (activeConnections < maxConnections) {
    return { ok: true };
  }
  return { ok: false, code: 'PTY_WS_MAX_CONNECTIONS' };
}
