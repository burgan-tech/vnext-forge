import type { HostEditorCapabilities } from '@vnext-forge/designer-ui';

/** Web SPA: Roslyn LSP over WebSocket; no webview postMessage filter. */
export function webHostEditorCapabilities(): HostEditorCapabilities {
  return {
    csharpLspUsesPostMessageTransport: false,
    postMessageAllowedOrigins: [],
  };
}
