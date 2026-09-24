/**
 * Narrows to a plain object (not null, not an array). Single implementation
 * shared by canvas-interaction helpers (state node data, human-task rules,
 * child workflow summaries) so the guard cannot drift between call sites.
 * Leaf module — no imports.
 */
export function isRec(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
