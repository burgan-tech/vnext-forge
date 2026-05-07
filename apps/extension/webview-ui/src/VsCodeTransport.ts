import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import { createLogger, isMessageOriginAllowed, type ApiTransport } from '@vnext-forge-studio/designer-ui';

import { resolveWebviewPostMessageAllowedOrigins } from './host/webviewMessageOrigins.js';

const logger = createLogger('extension/VsCodeTransport');

/**
 * Webview `postMessage` handle exposed by the `vscode` webview runtime.
 * The `acquireVsCodeApi()` helper is injected by the VS Code webview
 * container and returns a single instance per document load.
 */
export interface VsCodeWebviewApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeWebviewApi;
  }
}

interface PendingCall {
  resolve(value: ApiResponse<unknown>): void;
  reject(reason?: unknown): void;
}

interface WebviewApiEnvelope {
  requestId: string;
  type: 'api';
  method: string;
  params: unknown;
}

interface WebviewApiReply {
  requestId: string;
  result: ApiResponse<unknown>;
}

function isApiReply(value: unknown): value is WebviewApiReply {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.requestId === 'string' && 'result' in record;
}

/**
 * Creates an `ApiTransport` that tunnels every `send()` call through the
 * VS Code webview `postMessage` channel. Replies are correlated back to the
 * originating promise via a `requestId` map.
 *
 * The extension host side is served by `apps/extension/src/MessageRouter.ts`,
 * which forwards the call into the shared `services-core` method registry.
 */
export function createVsCodeTransport(api: VsCodeWebviewApi): ApiTransport {
  const pending = new Map<string, PendingCall>();
  const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();

  window.addEventListener('message', (event) => {
    if (!isMessageOriginAllowed(event.origin, allowedOrigins)) {
      logger.warn('Ignoring API postMessage from unexpected origin', { origin: event.origin });
      return;
    }

    const data = event.data as unknown;
    if (!isApiReply(data)) return;

    const entry = pending.get(data.requestId);
    if (!entry) return;

    pending.delete(data.requestId);
    entry.resolve(data.result);
  });

  return {
    send<T>(method: string, params: unknown): Promise<ApiResponse<T>> {
      const requestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `rpc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

      const envelope: WebviewApiEnvelope = {
        requestId,
        type: 'api',
        method,
        params: params ?? {},
      };

      return new Promise<ApiResponse<T>>((resolve, reject) => {
        pending.set(requestId, {
          resolve: resolve as PendingCall['resolve'],
          reject,
        });
        api.postMessage(envelope);
      });
    },
  };
}
