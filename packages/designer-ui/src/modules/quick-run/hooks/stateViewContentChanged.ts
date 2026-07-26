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
  return JSON.stringify(current.content) !== JSON.stringify(next.content);
}
