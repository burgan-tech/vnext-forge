/**
 * Host-injected editor/LSP transport capabilities. Replaces ad hoc
 * `acquireVsCodeApi` probing inside the Roslyn LSP client.
 */
export interface HostEditorCapabilities {
  /** Use the VS Code webview postMessage bridge instead of a browser WebSocket. */
  csharpLspUsesPostMessageTransport: boolean;
  /**
   * Origins allowed for inbound `postMessage` when using the LSP bridge.
   * Empty means "no origin filter" (standalone web — WebSocket path only).
   */
  postMessageAllowedOrigins: readonly string[];
}
