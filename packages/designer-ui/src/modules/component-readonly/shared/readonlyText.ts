/**
 * Scalar-safe stringification for read-only value rendering. Objects are
 * JSON-encoded instead of collapsing to `[object Object]`, and
 * null/undefined render as an empty string so the field shows its
 * placeholder.
 */
export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
