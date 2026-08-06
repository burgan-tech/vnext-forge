import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

export type FunctionScope = 'D' | 'F' | 'I'

export interface FunctionInfoPathInput {
  domain: string
  functionKey: string
  scope: FunctionScope
  workflowKey?: string | undefined
  instanceId?: string | undefined
}

/**
 * Deliberately narrower than a generic URL path segment: no `.`, so a
 * segment of exactly `..` (or `.`) cannot pass. A single caller-controlled
 * segment of `..` is still a traversal element once it's spliced between
 * the literals this function inserts — `functionKey: '..'` builds
 * `/api/v1/core/functions/../info`, which resolves to `/api/v1/core/info`.
 * `isValidRuntimePath` already rejects any `..` outright; if this pattern
 * admitted it, the two guards on the same concatenated path would disagree
 * about the most important input either of them checks.
 *
 * Alphanumerics plus `_` and `-` covers every real vNext domain/component
 * key (`^[a-z0-9-]+$` in the component schema, case-insensitively) and every
 * instance id (UUIDs: hex digits and `-`), so this is not merely defensive —
 * it is accurate to the domain. It intentionally does NOT match the schema
 * pattern exactly (no `.`/`~`, not case-restricted): admitting `.` is what
 * created this bug, so the two are kept apart on purpose rather than widened
 * back toward "any legal URL character" for schema parity.
 */
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/

function assertSegment(value: string, name: string): string {
  if (!PATH_SEGMENT.test(value)) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `${name} is not a valid path segment.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { name } },
    )
  }
  return value
}

/**
 * The single place that knows the scope→route rule.
 *
 * The engine exposes a function at two different routes and picks by scope;
 * the domain route answers 403 for an F/I function. Getting this wrong
 * surfaces as an authorization error, which sends the user hunting the wrong
 * bug — hence one tested function rather than string building at call sites.
 *
 * Every caller-controlled segment (`domain`, `functionKey`, `workflowKey`,
 * `instanceId`) is validated against `PATH_SEGMENT` before it is spliced in.
 * Segments are used as-is, never `encodeURIComponent`-ed: encoding would emit
 * `%`, which `isValidRuntimePath` rejects on the href side, and the two
 * functions would end up disagreeing about what a legal path looks like.
 */
export function buildFunctionInfoPath(input: FunctionInfoPathInput): string {
  const { scope } = input
  const domain = assertSegment(input.domain, 'domain')
  const functionKey = assertSegment(input.functionKey, 'functionKey')
  if (scope === 'D') {
    return `/api/v1/${domain}/functions/${functionKey}/info`
  }
  if (!input.workflowKey) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `A ${scope}-scoped function needs a workflowKey.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { scope } },
    )
  }
  const workflowKey = assertSegment(input.workflowKey, 'workflowKey')
  if (!input.instanceId) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `A ${scope}-scoped function needs an instanceId.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { scope } },
    )
  }
  const instanceId = assertSegment(input.instanceId, 'instanceId')
  return `/api/v1/${domain}/workflows/${workflowKey}/instances/${instanceId}/functions/${functionKey}/info`
}

const API_V1_PREFIX = '/api/v1/'

/**
 * `/info` emits hrefs relative to the API root (e.g. `/core/functions/x`),
 * while the runtime serves everything under `/api/v1` — see the route
 * comments on `quickrun.service.ts`'s `executeFunction`
 * (`/api/v1/{domain}/functions/{function}` and the instance-scoped
 * equivalent). Following an `/info` href verbatim would therefore 404.
 * Normalizing here means every caller of `fetchContract`/`invoke` gets the
 * same shape whether it started from a domain path or already carried the
 * prefix, instead of each call site having to know this.
 *
 * Idempotent: a href that already starts with `/api/v1/` is returned as-is.
 * A href that doesn't start with `/` at all is returned unchanged too — it
 * is not a same-origin path and `isValidRuntimePath` will reject it next.
 */
export function normalizeRuntimeHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith(API_V1_PREFIX)) return href
  return `/api/v1${href}`
}

/**
 * Path segment: unreserved characters only (RFC 3986 `unreserved`), plus `/`
 * to allow multiple segments. Deliberately excludes `%`.
 *
 * That exclusion is the entire traversal defence for this half of the
 * pattern: `path.includes('..')` below only catches a literal `..`, and
 * cannot see `%2e%2e`. The only thing standing between this validator and
 * `/core/functions/f/%2e%2e/%2e%2e/admin` is that `%` never appears in the
 * allowed path character set, so a percent-encoded traversal segment fails
 * the pattern match outright. Do NOT add `%` to this class to "fix" a
 * legitimate-looking rejection (e.g. a function key with a space that someone
 * encoded as `%20`) — that would silently reopen encoded path traversal.
 * Encoded characters belong in the query string only, where they cannot
 * change which route is requested.
 */
const PATH_CHARS = 'A-Za-z0-9._~\\-/'

/**
 * Query segment: RFC 3986 `query = *( pchar / "/" / "?" )`, where `pchar`
 * includes unreserved, sub-delims, `:` and `@`. This is deliberately wider
 * than the path class above — encoded/reserved characters are safe here
 * because the query string cannot change which runtime route is requested,
 * only what is passed to it.
 */
const QUERY_CHARS = "A-Za-z0-9._~\\-/=&%!$'()*+,;:@?"

const RUNTIME_PATH_PATTERN = new RegExp(`^/[${PATH_CHARS}]*(\\?[${QUERY_CHARS}]*)?$`)

/**
 * Validates an href handed back by `/info` before it is proxied.
 *
 * Defence in depth: `runtime-proxy` already pins the origin to an allowlisted
 * base URL, so a bad path cannot reach another host. This stops path
 * traversal and non-function routes from riding in on a parameter.
 *
 * The "is this a function route" check is deliberately run against the path
 * segment only (everything before the first `?`), not the raw input. Running
 * it against the whole string would let a query string smuggle the
 * `/functions/` marker in — e.g. `/core/workflows/w/instances/i?x=/functions/y`
 * is not a function route, but naively scanning the entire string for the
 * substring would say it is.
 */
export function isValidRuntimePath(path: string): boolean {
  if (typeof path !== 'string') return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('..')) return false
  if (path.includes('#')) return false
  if (!RUNTIME_PATH_PATTERN.test(path)) return false
  const pathOnly = path.split('?', 1)[0] ?? ''
  return pathOnly.includes('/functions/')
}
