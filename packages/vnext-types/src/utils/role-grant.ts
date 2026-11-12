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

/**
 * Predefined roles the runtime resolves on the grant side rather than
 * against the caller's static roles. `$Everyone` (vnext-schema 0.0.60 /
 * runtime 0.0.105) matches every caller: `deny $Everyone` hides from
 * everyone. Order is the order role pickers suggest them in.
 */
export const PREDEFINED_ROLES = [
  { role: '$InstanceStarter', description: 'The user who started the instance' },
  { role: '$InstanceBehalfOfStarter', description: 'The user the instance was started on behalf of' },
  { role: '$PreviousUser', description: 'The user who ran the last manual transition' },
  { role: '$PreviousBehalfOfUser', description: 'The behalf-of user of the last manual transition' },
  { role: '$Everyone', description: 'Every caller — deny $Everyone hides from everyone' },
] as const;

export type PredefinedRole = (typeof PREDEFINED_ROLES)[number]['role'];

export const EVERYONE_ROLE = '$Everyone';

/**
 * Mirrors the runtime publish check that `$Everyone` is spelled exactly
 * (Ordinal): `$everyone` / `$EVERYONE` are rejected on every role-grant
 * surface. Only `$Everyone` gets this check. Returns the message, or
 * `undefined` when the role is fine.
 */
export function predefinedRoleCasingIssue(role: string | undefined): string | undefined {
  if (!role || role === EVERYONE_ROLE) return undefined;
  if (role.toLowerCase() !== EVERYONE_ROLE.toLowerCase()) return undefined;
  return `Predefined roles are case-sensitive, write '${EVERYONE_ROLE}'.`;
}

/**
 * `$Everyone` would exempt every caller from `x-masking` / `x-encryption`,
 * so the runtime rejects it in those plain exemption lists (fail closed).
 */
export function exemptionRoleIssue(role: string | undefined): string | undefined {
  if (!role) return undefined;
  if (role.toLowerCase() === EVERYONE_ROLE.toLowerCase()) {
    return `${EVERYONE_ROLE} is not allowed here: it would exempt every caller.`;
  }
  return undefined;
}
