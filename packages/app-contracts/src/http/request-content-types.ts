/**
 * Request content types a caller may ask the runtime proxy to send. vNext
 * functions accept JSON and form-urlencoded; anything else must fall back to
 * JSON rather than being forwarded verbatim.
 *
 * Canonical home for this pair: `services-core`'s runtime-proxy service
 * enforces it as an SSRF-relevant safety boundary, and `designer-ui`'s Quick
 * Runner needs the same two values to build its request form. Neither
 * package may import the other, so the pair lives here instead of being
 * duplicated.
 */
export const RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
] as const

export type RuntimeProxyAllowedRequestContentType =
  (typeof RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES)[number]
