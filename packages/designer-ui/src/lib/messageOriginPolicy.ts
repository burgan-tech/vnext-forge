/**
 * Shared allowlist check for `MessageEvent.origin` (webview API + LSP bridge).
 */
export function isMessageOriginAllowed(
  origin: string,
  allowedOrigins: readonly string[],
): boolean {
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
}
