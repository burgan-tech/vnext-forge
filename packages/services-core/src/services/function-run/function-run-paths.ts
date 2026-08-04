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
 * The single place that knows the scope→route rule.
 *
 * The engine exposes a function at two different routes and picks by scope;
 * the domain route answers 403 for an F/I function. Getting this wrong
 * surfaces as an authorization error, which sends the user hunting the wrong
 * bug — hence one tested function rather than string building at call sites.
 */
export function buildFunctionInfoPath(input: FunctionInfoPathInput): string {
  const { domain, functionKey, scope } = input
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
  if (!input.instanceId) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `A ${scope}-scoped function needs an instanceId.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { scope } },
    )
  }
  return `/api/v1/${domain}/workflows/${input.workflowKey}/instances/${input.instanceId}/functions/${functionKey}/info`
}

const RUNTIME_PATH_PATTERN = /^\/[A-Za-z0-9._~\-/]*(\?[A-Za-z0-9._~\-/=&%]*)?$/

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
  if (!path || !path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('..')) return false
  if (path.includes('#')) return false
  if (!RUNTIME_PATH_PATTERN.test(path)) return false
  const pathOnly = path.split('?', 1)[0] ?? ''
  return pathOnly.includes('/functions/')
}
