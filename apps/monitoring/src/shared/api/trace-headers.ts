function randomSpanIdHex(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

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
