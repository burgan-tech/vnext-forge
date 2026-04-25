import type { HostEditorCapabilities } from '@vnext-forge/designer-ui';

import { resolveWebviewPostMessageAllowedOrigins } from './webviewMessageOrigins.js';

/**
 * VS Code webview: LSP uses postMessage; API/LSP frames must pass origin checks
 * (see `VsCodeTransport` and `lspClient` listeners).
 */
export function extensionHostEditorCapabilities(): HostEditorCapabilities {
  return {
    csharpLspUsesPostMessageTransport: typeof window.acquireVsCodeApi === 'function',
    postMessageAllowedOrigins: resolveWebviewPostMessageAllowedOrigins(),
  };
}
