import {
  ERROR_CODES,
  RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES,
  VnextForgeError,
} from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type { LoggerAdapter, NetworkAdapter } from '../../adapters/index.js'

export interface RuntimeProxyServiceDeps {
  network: NetworkAdapter
  logger: LoggerAdapter
  defaultRuntimeUrl?: string
  /**
   * Extra runtime base URLs that may be targeted via `req.runtimeUrl`. The
   * `defaultRuntimeUrl` is implicitly always allowed; this list extends it.
   * If `allowRuntimeUrlOverride` is `false`, this list is ignored — only
   * the default is reachable.
   *
   * A callback form `() => readonly string[]` is also accepted. It is called
   * on every request so callers can provide a live-updating list (e.g. Forge
   * Tools environments) without recreating the service.
   */
  allowedBaseUrls?: readonly string[] | (() => readonly string[])
  /**
   * When `false` (the default), the `runtimeUrl` parameter on
   * `runtime.proxy` is rejected and every request goes to
   * `defaultRuntimeUrl`. This is the SSRF-safe configuration.
   *
   * Set to `true` only when you intentionally want callers to choose
   * which allow-listed runtime to talk to (e.g. a multi-runtime designer
   * desktop). Even then the candidate must appear in `allowedBaseUrls` or
   * equal `defaultRuntimeUrl`.
   */
  allowRuntimeUrlOverride?: boolean
}

/** Hop-by-hop and connection headers that must not be forwarded (R-b4). */
export const RUNTIME_PROXY_HOP_BY_HOP_HEADER_NAMES = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
] as const

const hopByHopLower = new Set(
  RUNTIME_PROXY_HOP_BY_HOP_HEADER_NAMES.map((name) => name.toLowerCase()),
)

const RUNTIME_PROXY_USER_AGENT = 'vnext-forge-studio/0.1.0'

function stripHopByHopHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (hopByHopLower.has(key.toLowerCase())) continue
    out[key] = value
  }
  return out
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The complete set of Content-Type values this proxy will forward, anchored
 * end to end: an allowlisted media type, optionally followed by a single
 * `charset` parameter (token or quoted-string), separated only by spaces or
 * tabs.
 *
 * Anchoring the whole value — rather than validating a trimmed slice and
 * returning the original — is deliberate. Two earlier attempts checked the
 * media type and the parameter tail separately, and both times a control
 * character survived in the gap between them (first after the `;`, then
 * before it) because the validated form and the returned form were not the
 * same string. There is no gap to hide in here.
 */
const SAFE_REQUEST_CONTENT_TYPE = new RegExp(
  `^(?:${RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES.map(escapeForRegExp).join('|')})` +
    `(?:[ \\t]*;[ \\t]*charset=(?:[\\w.-]+|"[\\w.-]+"))?$`,
  'i',
)

/**
 * Removes every header matching `lowerName` (case-insensitively) from
 * `headers` **in place** and returns the first value found, so callers get a
 * single well-defined answer to "what did the caller send" even if the
 * caller's object somehow had more than one casing of the same header.
 */
function takeHeader(headers: Record<string, string>, lowerName: string): string | undefined {
  let found: string | undefined
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== lowerName) continue
    found ??= headers[key]
    delete headers[key]
  }
  return found
}

/**
 * Resolves the outbound Content-Type from what the caller supplied. This is
 * the safety boundary for the runtime proxy's SSRF-sensitive header path.
 * Leading/trailing spaces and tabs (HTTP's own optional whitespace) are
 * stripped, and the remaining value must match `SAFE_REQUEST_CONTENT_TYPE`
 * end to end; anything that doesn't match — including a value that only
 * became safe after the strip, such as one with a bare CR or LF at either
 * edge — falls back to `application/json`. If a caller's header object
 * somehow contained duplicate Content-Type keys under different casing,
 * `takeHeader` resolves that by insertion order — acceptable because the
 * fallback direction is always the safe one.
 */
function resolveOutboundContentType(suppliedContentType: string | undefined): string {
  if (!suppliedContentType) return 'application/json'
  // Strip only HTTP optional whitespace (space and tab). Notably NOT \s —
  // a CR or LF at either edge must fail the match, not be quietly removed.
  const value = suppliedContentType.replace(/^[ \t]+|[ \t]+$/g, '')
  return SAFE_REQUEST_CONTENT_TYPE.test(value) ? value : 'application/json'
}

/**
 * Builds outbound fetch headers for the runtime HTTP proxy. Content-Type is
 * owned by this function and set only when a body is sent, honouring an
 * allowlisted caller-supplied Content-Type when present.
 */
export function buildRuntimeProxyOutboundHeaders(params: {
  method: string
  body?: string | undefined
  callerHeaders?: Record<string, string> | undefined
  traceId?: string | undefined
}): Record<string, string> {
  const method = params.method.toUpperCase()
  const stripped = stripHopByHopHeaders(params.callerHeaders)
  // Drop any caller Content-Type; it is re-applied below only when a body is
  // actually sent, and only after allowlist validation.
  const suppliedContentType = takeHeader(stripped, 'content-type')

  const headers: Record<string, string> = {
    'User-Agent': RUNTIME_PROXY_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    ...stripped,
  }

  const hasBody = Boolean(params.body && params.body.length > 0)
  const sendsEntityBody = method !== 'GET' && method !== 'HEAD' && hasBody
  if (sendsEntityBody) {
    headers['Content-Type'] = resolveOutboundContentType(suppliedContentType)
  }

  if (params.traceId) {
    headers['X-Trace-Id'] = params.traceId
  }

  return headers
}

export const runtimeProxyParams = z.object({
  method: z.string().min(1),
  runtimePath: z.string().min(1),
  query: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  runtimeUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const runtimeProxyResult = z.object({
  status: z.number().int(),
  contentType: z.string(),
  data: z.string(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
})

export function createRuntimeProxyService(deps: RuntimeProxyServiceDeps) {
  const {
    network,
    defaultRuntimeUrl = 'http://localhost:4201',
    allowedBaseUrls: allowedBaseUrlsSource = [],
    allowRuntimeUrlOverride = false,
  } = deps

  // Trailing slashes are dropped because `${base}${path}` joins them anyway.
  const normalize = (u: string) => u.trim().replace(/\/+$/, '')
  const normalizedDefault = normalize(defaultRuntimeUrl)

  async function proxy(
    req: z.infer<typeof runtimeProxyParams>,
    traceId?: string,
  ): Promise<z.infer<typeof runtimeProxyResult>> {
    // Resolve allowlist fresh on each call so callback-based lists stay current.
    const rawAllowedUrls =
      typeof allowedBaseUrlsSource === 'function'
        ? allowedBaseUrlsSource()
        : allowedBaseUrlsSource
    const allowed = new Set<string>([
      normalizedDefault,
      ...rawAllowedUrls.map(normalize),
    ])

    let runtimeUrl: string
    if (req.runtimeUrl) {
      const candidate = normalize(req.runtimeUrl)

      // When the caller sends the same URL as the default, treat it as a
      // no-op — it is not an override and does not require the flag.
      if (candidate !== normalizedDefault && !allowRuntimeUrlOverride) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          'runtimeUrl override is disabled on this server. ' +
            'Set ALLOW_RUNTIME_URL_OVERRIDE=true and add the URL to ' +
            'RUNTIME_ALLOWED_BASE_URLS to enable it.',
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: { attemptedRuntimeUrl: req.runtimeUrl },
          },
          traceId,
        )
      }
      // A callback source is always treated as an explicit allowlist, even when
      // it currently returns an empty array, so we can reject URLs that aren't
      // listed yet (the list may grow dynamically at runtime).
      const hasExplicitAllowlist =
        typeof allowedBaseUrlsSource === 'function' || rawAllowedUrls.length > 0
      if (hasExplicitAllowlist && !allowed.has(candidate)) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          `runtimeUrl ${req.runtimeUrl} is not in the allow-list.`,
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: {
              attemptedRuntimeUrl: req.runtimeUrl,
              allowedBaseUrls: [...allowed],
            },
          },
          traceId,
        )
      }
      runtimeUrl = candidate
    } else {
      runtimeUrl = normalizedDefault
    }
    const url = `${runtimeUrl}${req.runtimePath}`
    const queryString = req.query ? new URLSearchParams(req.query).toString() : ''
    const fullUrl = queryString ? `${url}?${queryString}` : url
    const method = req.method.toUpperCase()

    try {
      const headers = buildRuntimeProxyOutboundHeaders({
        method,
        body: req.body,
        callerHeaders: req.headers,
        traceId,
      })
      const init: { method: string; headers: Record<string, string>; body?: string } = {
        method,
        headers,
      }
      if (method !== 'GET' && method !== 'HEAD' && req.body) {
        init.body = req.body
      }
      const response = await network.fetch(fullUrl, init)
      const data = await response.text()
      return {
        status: response.status,
        contentType: response.contentType ?? 'application/json',
        data,
        responseHeaders: response.headers,
      }
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_CONNECTION_FAILED,
        error instanceof Error ? error.message : 'Runtime connection failed',
        {
          source: 'RuntimeProxyService.proxy',
          layer: 'infrastructure',
          details: { runtimeUrl, fullUrl, method },
        },
        traceId,
      )
    }
  }

  return { proxy }
}

export type RuntimeProxyService = ReturnType<typeof createRuntimeProxyService>
