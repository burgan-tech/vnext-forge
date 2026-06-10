/**
 * Schema-agnostic walker that finds every `{ location, code, encoding? }`
 * triple inside a parsed component JSON. Every script-carrying shape
 * across the workflow / function / extension / mapping schemas wraps
 * `code` next to `location` in the same object — walking generically
 * survives future schema additions without code changes.
 *
 * The walker does NOT mutate; callers receive an array of
 * `MappingTripleHit` records and apply edits in-place.
 */

const CSX_LOCATION_PATTERN = /^\.\/.*\.csx$/i;

export interface MappingTripleHit {
  /** Path of keys/indices from the JSON root to the matched object. */
  path: (string | number)[];
  /** Reference to the actual JSON object (mutable — callers may edit `code` / `encoding` in place). */
  node: Record<string, unknown>;
  /** Trimmed `location` string from the node (already validated against `^\./.*\.csx$`). */
  location: string;
  /** Raw `encoding` value as stored on the node (may be undefined). */
  encoding: string | undefined;
  /** Raw `code` value as stored on the node (string for B64/NAT, object for REF, undefined when absent). */
  code: unknown;
}

/**
 * Recursively walk `json` and yield every object that has both a
 * string `location` matching `^\./.*\.csx$` and a `code` key. Arrays
 * are walked element-wise.
 */
export function walkMappingTriples(json: unknown): MappingTripleHit[] {
  const hits: MappingTripleHit[] = [];
  walk(json, [], hits);
  return hits;
}

function walk(value: unknown, path: (string | number)[], out: MappingTripleHit[]): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], [...path, i], out);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  const loc = obj.location;
  if (typeof loc === 'string' && CSX_LOCATION_PATTERN.test(loc.trim()) && 'code' in obj) {
    out.push({
      path,
      node: obj,
      location: loc.trim(),
      encoding: typeof obj.encoding === 'string' ? obj.encoding : undefined,
      code: obj.code,
    });
  }
  for (const [key, child] of Object.entries(obj)) {
    if (key === 'location' || key === 'code' || key === 'encoding') continue;
    walk(child, [...path, key], out);
  }
}
