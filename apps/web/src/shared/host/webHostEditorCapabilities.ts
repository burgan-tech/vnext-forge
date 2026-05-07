import type { HostEditorCapabilities } from '@vnext-forge-studio/designer-ui';

import { config } from '@shared/config/config';

/** Web SPA: Roslyn LSP over WebSocket; no webview postMessage filter. */
export function webHostEditorCapabilities(): HostEditorCapabilities {
  return {
    csharpLspUsesPostMessageTransport: false,
    postMessageAllowedOrigins: [],
    // In dev the SPA runs on :3000 and the API/LSP-WS on :3001, so we need an
    // explicit base URL. In production builds `apiBaseUrl` is empty (same
    // origin) and the client falls back to `window.location`.
    lspWebSocketBaseUrl: config.apiBaseUrl || undefined,
  };
}
