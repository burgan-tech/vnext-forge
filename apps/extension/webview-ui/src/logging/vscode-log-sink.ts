import type { LogLevel, LogSink } from '@vnext-forge/designer-ui';

import type { VsCodeWebviewApi } from '../VsCodeTransport';

/**
 * Frame envelope sent from the webview to the extension host for every
 * `createLogger(...)` call. The host MessageRouter forwards each entry to a
 * native VS Code OutputChannel (`vnext-forge:webview`) so devs can read
 * webview logs alongside the host logs in one place.
 */
export interface HostLogFrame {
  type: 'host:log';
  level: LogLevel;
  scope: string;
  message: string;
  /** Already-sanitized payload from createLogger; safe to JSON.stringify. */
  payload?: unknown;
  /** Webview-side timestamp (ISO) so out-of-order delivery still reads. */
  timestamp: string;
}

/**
 * Build a {@link LogSink} that forwards every log entry to the VS Code
 * extension host via `postMessage`. Best-effort: if the host transport
 * throws (e.g. webview is being torn down) we swallow the error rather than
 * recursing back through the logger.
 */
export function createVsCodeLogSink(api: VsCodeWebviewApi): LogSink {
  return {
    write(level, scope, message, payload) {
      const frame: HostLogFrame = {
        type: 'host:log',
        level,
        scope,
        message,
        timestamp: new Date().toISOString(),
      };

      if (payload !== undefined) {
        frame.payload = payload;
      }

      try {
        api.postMessage(frame);
      } catch {
        // Best-effort: never let logging crash the webview.
      }
    },
  };
}
