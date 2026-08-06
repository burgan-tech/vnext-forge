export type StatusClass = 'informational' | 'success' | 'redirect' | 'client-error' | 'server-error';

/**
 * Buckets an HTTP status for the runner's response banner.
 *
 * `functions/invoke` and friends resolve with whatever status the runtime
 * (or a proxy in front of it) actually returned, so this must never throw —
 * an out-of-range value (0, negative, `NaN`) falls through every `>=` check
 * and lands on `'informational'`, the least alarming bucket, rather than
 * crashing the runner over a malformed response.
 */
export function classifyStatus(status: number): StatusClass {
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'client-error';
  if (status >= 300) return 'redirect';
  if (status >= 200) return 'success';
  return 'informational';
}

/**
 * The runtime shares one `IFunctionAccessPolicy` between discovery and
 * execution, so a 403 on `/info` means the same denial as a 403 on invoke.
 * Worth its own banner: it is a permissions problem, not a broken function.
 */
export function isAuthorizationFailure(status: number): boolean {
  return status === 401 || status === 403;
}
