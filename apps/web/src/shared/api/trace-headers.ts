/** Random 16 hex chars (8 bytes) for W3C `span-id`. */
function randomSpanIdHex(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Outbound linked-trace headers for the web SPA (`trace-v1` consumer).
 * The server remains authoritative for the response `X-Trace-Id`; `traceparent`
 * carries client-side linkage for correlation (ADR-002).
 */
export function buildOutboundTraceHeaders(): {
  'X-Trace-Id': string;
  traceparent: string;
} {
  const xTraceId = crypto.randomUUID();
  const traceId32 = xTraceId.replace(/-/g, '');
  const spanId16 = randomSpanIdHex();
  const traceparent = `00-${traceId32}-${spanId16}-01`;
  return { 'X-Trace-Id': xTraceId, traceparent };
}

/** Wraps `fetch` so every request sends fresh `X-Trace-Id` and `traceparent`. */
export function createTraceInjectingFetch(baseFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    const trace = buildOutboundTraceHeaders();
    const nextInit: RequestInit = { ...init };
    const headers = new Headers(init?.headers);
    headers.set('X-Trace-Id', trace['X-Trace-Id']);
    headers.set('traceparent', trace.traceparent);
    nextInit.headers = headers;
    return baseFetch(input, nextInit);
  };
}
