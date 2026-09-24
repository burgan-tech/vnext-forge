import type { AuthorizeResult, AuthorizeTarget, TransitionInfo } from '../types/quickrun.types';

/** One `authorize` answer, or why it could not be obtained. */
export type AuthorizeVerdict =
  | { kind: 'verdict'; allowed: boolean; status: number }
  | { kind: 'error'; message: string };

export type AuthorizeCallResult =
  | { success: true; data: AuthorizeResult }
  | { success: false; error: { message: string } };

export type AuthorizeCall = (target: AuthorizeTarget, role: string | undefined) => Promise<AuthorizeCallResult>;

export interface PermissionCheckResult {
  key: string;
  role: string | undefined;
  transitions: Record<string, AuthorizeVerdict>;
  /** `?queryRoles=true` — may this role read the instance? */
  queryRoles: AuthorizeVerdict;
}

export async function resolveVerdict(call: Promise<AuthorizeCallResult>): Promise<AuthorizeVerdict> {
  try {
    const res = await call;
    return res.success
      ? { kind: 'verdict', allowed: res.data.allowed, status: res.data.status }
      : { kind: 'error', message: res.error.message };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Checks are cached per (eTag, role): the eTag moves whenever the state,
 * its transitions or the incident flag change. Older runtimes without an
 * eTag fall back to the instance + state key.
 */
export function permissionCacheKey(eTag: string | undefined, fallback: string, role: string | undefined): string {
  return `${eTag ?? `state:${fallback}`}|${role ?? ''}`;
}

/** Callable transitions of the current state (scheduled entries are engine-fired). */
export function checkableTransitionKeys(
  transitions: readonly TransitionInfo[],
  sharedTransitions: readonly TransitionInfo[],
): string[] {
  const keys = [...transitions, ...sharedTransitions].filter((t) => t.kind !== 'scheduled').map((t) => t.name);
  return [...new Set(keys)];
}

export async function runPermissionChecks(input: {
  key: string;
  role: string | undefined;
  transitionKeys: readonly string[];
  authorize: AuthorizeCall;
}): Promise<PermissionCheckResult> {
  const unique = [...new Set(input.transitionKeys)];
  const [queryRoles, ...verdicts] = await Promise.all([
    resolveVerdict(input.authorize({ kind: 'queryRoles' }, input.role)),
    ...unique.map((transitionKey) => resolveVerdict(input.authorize({ kind: 'transition', transitionKey }, input.role))),
  ]);
  const transitions: Record<string, AuthorizeVerdict> = {};
  unique.forEach((key, i) => {
    transitions[key] = verdicts[i];
  });
  return { key: input.key, role: input.role, transitions, queryRoles };
}

/**
 * A batch in which every verdict is an error (runtime unreachable, auth
 * header missing, …) is shown but not treated as cached: the next render
 * whose inputs change — or toggling the checks — retries it.
 */
export function isCacheablePermissionBatch(result: PermissionCheckResult): boolean {
  return [result.queryRoles, ...Object.values(result.transitions)].some((v) => v.kind !== 'error');
}

/**
 * What a manual authorize verdict is about: the state (eTag) and the keys
 * that were available. A verdict is cleared once this changes.
 */
export function authorizeVerdictScope(
  stateETag: string | undefined,
  transitionKeys: readonly string[],
  functionKeys: readonly string[],
): string {
  return JSON.stringify([stateETag ?? null, transitionKeys, functionKeys]);
}

export function verdictText(v: AuthorizeVerdict): string {
  if (v.kind === 'error') return `Check failed: ${v.message}`;
  return `${v.allowed ? 'Allowed' : 'Denied'} (HTTP ${v.status})`;
}

export function visibilityText(v: AuthorizeVerdict): string {
  if (v.kind === 'error') return 'Visibility check failed';
  return v.allowed ? 'Instance visible to this role' : 'Instance hidden from this role';
}

export function buildAuthorizeTarget(kind: AuthorizeTarget['kind'], key: string): AuthorizeTarget | null {
  switch (kind) {
    case 'transition':
      return key ? { kind, transitionKey: key } : null;
    case 'function':
      return key ? { kind, functionKey: key } : null;
    case 'queryRoles':
      return { kind: 'queryRoles' };
    case 'ack':
      return { kind: 'ack' };
  }
}
