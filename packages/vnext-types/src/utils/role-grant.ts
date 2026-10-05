import type { RoleGrant, RoleGrantMode } from '../types/role';

/** Which of the three mutually exclusive grant forms `grant` uses. */
export function roleGrantMode(grant: Pick<RoleGrant, 'allOf' | 'anyOf'>): RoleGrantMode {
  if (Array.isArray(grant.allOf)) return 'allOf';
  if (Array.isArray(grant.anyOf)) return 'anyOf';
  return 'role';
}

export function isCombinatorGrant(grant: Pick<RoleGrant, 'allOf' | 'anyOf'>): boolean {
  return roleGrantMode(grant) !== 'role';
}

/** Every role name a grant mentions, in declaration order. */
export function leafRoles(grant: RoleGrant): string[] {
  const mode = roleGrantMode(grant);
  if (mode === 'role') return grant.role ? [grant.role] : [];
  return (grant[mode] ?? []).map((c) => c.role);
}

/** Short human-readable form, e.g. `a`, `all of (a, b)`, `any of (c)`. */
export function describeRoleGrant(grant: RoleGrant): string {
  const mode = roleGrantMode(grant);
  if (mode === 'role') return grant.role ?? '';
  const roles = leafRoles(grant).join(', ');
  return mode === 'allOf' ? `all of (${roles})` : `any of (${roles})`;
}
