/**
 * The `availableIn` codec for workflow transitions.
 *
 * A transition's `availableIn` accepts two authored shapes, mixable in one
 * array:
 *
 * ```jsonc
 * "availableIn": [
 *   "review",                                                    // bare state key
 *   { "state": "approval" },                                     // identical to the bare form
 *   { "state": "approval", "roles": [ { "role": "x", "grant": "allow" } ] }
 * ]
 * ```
 *
 * Everything that reads or writes that field goes through this module — the
 * transition editor, the canvas edge builder, the read-only monitoring
 * surface, validation and doc-gen — so the parse rule and the write rule
 * cannot drift apart.
 */

import type { RoleGrant } from '../types/role';
import type { AvailableIn, AvailableInEntry } from '../types/available-in';

/** A non-empty string, trimmed — anything else reads as "not a state key". */
function asStateKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRoleGrants(value: unknown): RoleGrant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const grants = value.filter(
    (g): g is RoleGrant =>
      g !== null && typeof g === 'object' && typeof (g as RoleGrant).role === 'string',
  );
  return grants.length > 0 ? grants : undefined;
}

/**
 * Read an authored `availableIn` value into a uniform entry list.
 *
 * Deliberately tolerant, like `parseViewDisplay`: an item that is neither a
 * usable string nor an object with a `state` key is skipped rather than
 * throwing, because the editor must never crash on hand-authored JSON.
 * Membership and shape are the JSON schema's job, and Forge surfaces that as a
 * validation error on save.
 */
export function parseAvailableIn(raw: unknown): AvailableInEntry[] {
  if (!Array.isArray(raw)) return [];

  const entries: AvailableInEntry[] = [];
  for (const item of raw) {
    const asString = asStateKey(item);
    if (asString !== undefined) {
      entries.push({ state: asString });
      continue;
    }

    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const state = asStateKey(record.state);
      if (state === undefined) continue;
      const roles = asRoleGrants(record.roles);
      entries.push(roles !== undefined ? { state, roles } : { state });
    }
  }
  return entries;
}

/**
 * Write an entry list back to the authored shape.
 *
 * Mirrors the runtime: an entry carrying no role grants becomes a **bare
 * string**, and only an entry with grants becomes an object. That is not
 * cosmetic — without it every save of an existing workflow would rewrite
 * `"review"` as `{"state":"review"}` and churn the JSON of every domain repo.
 *
 * Returns `undefined` for an empty list; the caller must then **remove** the
 * `availableIn` key. An empty array and an absent key mean the same thing to
 * the runtime (available in every state), and dropping the key keeps the
 * authored JSON minimal.
 */
export function serializeAvailableIn(
  entries: AvailableInEntry[],
): AvailableIn | undefined {
  const items: AvailableIn = [];
  for (const entry of entries) {
    const state = asStateKey(entry.state);
    if (state === undefined) continue;
    const roles = asRoleGrants(entry.roles);
    items.push(roles !== undefined ? { state, roles } : state);
  }
  return items.length > 0 ? items : undefined;
}

/**
 * Just the state keys, in authored order — for canvas edge sources, mermaid
 * arrows and dangling-reference validation, none of which care about roles.
 */
export function availableInStateKeys(raw: unknown): string[] {
  return parseAvailableIn(raw).map((entry) => entry.state);
}

/**
 * Compact single-line summary for read-only surfaces (monitoring inspector,
 * doc tables). Role-scoped states carry a grant count so a reader can tell the
 * two forms apart without expanding anything.
 */
export function formatAvailableIn(raw: unknown, emptyText = '—'): string {
  const entries = parseAvailableIn(raw);
  if (entries.length === 0) return emptyText;

  return entries
    .map((entry) => {
      const count = entry.roles?.length ?? 0;
      if (count === 0) return entry.state;
      return `${entry.state} (${count} role${count > 1 ? 's' : ''})`;
    })
    .join(', ');
}
