import type { HostEditorCapabilities } from '@vnext-forge/designer-ui';

import type { VsCodeWebviewApi } from '../VsCodeTransport.js';
import { resolveWebviewPostMessageAllowedOrigins } from './webviewMessageOrigins.js';

/**
 * VS Code webview: LSP uses postMessage; API/LSP frames must pass origin checks
 * (see `VsCodeTransport` and `lspClient` listeners). The single
 * `acquireVsCodeApi()` instance lives in `main.tsx` and is threaded in here so
 * the LSP client never tries to re-acquire it (VS Code throws on a second
 * call).
 */
export function extensionHostEditorCapabilities(
  api: VsCodeWebviewApi,
): HostEditorCapabilities {
  return {
    csharpLspUsesPostMessageTransport: true,
    postMessageAllowedOrigins: resolveWebviewPostMessageAllowedOrigins(),
    postMessageToHost: (message: unknown) => api.postMessage(message),
    nativeStatusBar: true,
  };
}
