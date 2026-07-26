import type { ViewResponse } from '../types/quickrun.types';

/**
 * Decides whether a freshly-fetched View payload should replace what is
 * currently rendered as `stateView`.
 *
 * View has no ETag (product decision — State/Data/Schema get conditional
 * requests, View does not), so the poll loop fetches it unconditionally on
 * every eligible iteration. Without a check like this, an unchanged view
 * would still be written to the store every ~4s poll tick, re-mounting the
 * pseudo-ui iframe and causing visible flicker. Comparing `content` (the
 * only field that reflects the actual rendered payload) lets callers skip
 * the `setStateView` write when nothing actually changed.
 */
export function stateViewContentChanged(
  current: ViewResponse | null,
  next: ViewResponse,
): boolean {
  if (!current) return true;
  return stableStringify(current.content) !== stableStringify(next.content);
}

/**
 * `JSON.stringify` with object keys sorted at every level, so two
 * structurally-identical payloads compare equal regardless of key order.
 * A plain `JSON.stringify` diff would otherwise treat a re-serialization
 * with reordered keys (e.g. the same view content round-tripped through a
 * different object construction order upstream) as "changed" and cause a
 * spurious `setStateView` write / iframe flicker.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) sorted[key] = sortKeysDeep(val);
    return sorted;
  }
  return value;
}
