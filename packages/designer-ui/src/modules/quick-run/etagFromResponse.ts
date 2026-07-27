/**
 * Extracts an ETag from a quickrun state/data/schema response so callers can
 * echo it back as `If-None-Match` on the next request for the same resource.
 *
 * The runtime-proxy network adapter lowercases response header keys, so the
 * ETag header normally arrives as `responseHeaders['etag']` — but this scans
 * case-insensitively to be resilient to any future header-casing change, and
 * falls back to the payload-level `eTag` field (present on `StateResponse` /
 * `DataResponse` / `SchemaResponse`) when no header is present.
 */
export function extractEtag(
  resp: { responseHeaders?: Record<string, string>; eTag?: string } | null | undefined,
): string | undefined {
  if (!resp) return undefined;
  const headers = resp.responseHeaders;
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === 'etag' && v) return v;
    }
  }
  return resp.eTag || undefined;
}
