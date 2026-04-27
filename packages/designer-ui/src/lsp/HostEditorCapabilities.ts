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
  /**
   * Base origin (e.g. `http://localhost:3001`) for the Roslyn LSP WebSocket.
   * The client rewrites the scheme to `ws://` / `wss://` automatically.
   * Leave undefined to fall back to the page's own origin (works when the
   * SPA is served same-origin with the API in production builds).
   */
  lspWebSocketBaseUrl?: string;
  /**
   * Sender for outbound LSP frames over `postMessage`. The webview shell owns
   * the single `acquireVsCodeApi()` instance and exposes its `postMessage`
   * here so the LSP client never tries to re-acquire (VS Code throws on a
   * second call).
   */
  postMessageToHost?: (message: unknown) => void;
}
