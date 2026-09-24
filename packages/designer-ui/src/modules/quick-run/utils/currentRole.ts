/**
 * The QuickRunner's "current role". The runtime's default caller-role provider
 * reads the `role` header (and `x-roles` for the full set), so the role the
 * user configured in the Headers dialog is the one every call already carries.
 */
function headerLookup(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

export function currentRoleFromHeaders(headers?: Record<string, string>): string | undefined {
  const role = headerLookup(headers, 'role')?.trim();
  if (role) return role;
  const first = headerLookup(headers, 'x-roles')
    ?.split(',')
    .map((r) => r.trim())
    .find((r) => r.length > 0);
  return first ?? undefined;
}

/** Headers with `role` and `x-roles` replaced by `role` (any existing spelling removed). */
export function withRoleHeaders(headers: Record<string, string>, role: string | undefined): Record<string, string> {
  const trimmed = role?.trim();
  if (!trimmed) return { ...headers };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower !== 'role' && lower !== 'x-roles') out[key] = value;
  }
  out.role = trimmed;
  out['x-roles'] = trimmed;
  return out;
}
