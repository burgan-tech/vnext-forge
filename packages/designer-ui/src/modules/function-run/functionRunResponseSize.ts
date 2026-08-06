/**
 * Pure helpers for the response summary row's size figure (3a).
 *
 * `FunctionExchange.body` is a JS string, and a string's own `.length` counts
 * UTF-16 code units, not bytes — for any body containing a character outside
 * the Basic Multilingual Plane's single-code-unit range (accented Latin,
 * non-Latin scripts, emoji, …) that undercounts what actually crossed the
 * wire. Rather than label a UTF-16 count as a "size" (which it isn't) or
 * silently accept the wrong number for non-ASCII bodies, this re-encodes as
 * UTF-8 via `TextEncoder` and counts the real bytes — the same encoding the
 * runtime's own `Content-Length` would report for a JSON/text response.
 */
export function computeResponseByteSize(body: string): number {
  return new TextEncoder().encode(body).length;
}

const KB = 1024;
const MB = KB * 1024;

/**
 * Formats a byte count for display in the response summary row.
 *
 * Below 1 KB, the exact integer count — there is no meaningful fractional
 * byte, and small bodies are exactly where an approximate figure would be
 * least useful. At 1 KB and above, one decimal place: enough precision to be
 * useful without reading as false accuracy for what is, past that point,
 * necessarily an approximation.
 */
export function formatResponseSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
