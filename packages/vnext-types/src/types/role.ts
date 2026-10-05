/** One leaf of an `allOf` / `anyOf` role grant. Children carry `role` only. */
export interface RoleGrantCondition {
  role: string;
}

/**
 * Role-based access grant, reusable across states, transitions, functions,
 * schema `x-roles` and subflow overrides.
 *
 * Exactly one of `role`, `allOf` or `anyOf` is set (schema `oneOf`). The
 * combinators are one level deep and were added in vnext-schema 0.0.55 /
 * runtime 0.0.99; older schemas accept the single-`role` form only.
 */
export interface RoleGrant {
  role?: string;
  allOf?: RoleGrantCondition[];
  anyOf?: RoleGrantCondition[];
  grant: 'allow' | 'deny';
}

export type RoleGrantMode = 'role' | 'allOf' | 'anyOf';
