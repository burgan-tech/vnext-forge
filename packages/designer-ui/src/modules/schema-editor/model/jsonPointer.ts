/**
 * RFC 6901 JSON Pointer helpers used to address nodes inside a schema tree.
 *
 * Pointers are schema-relative — e.g. `/properties/status/allOf/0`. The empty
 * string `""` addresses the schema root. Mutators in this module never reach
 * outside the supplied root; callers descend to `attributes.schema` first.
 */

export type JsonPointer = string;

export const ROOT_POINTER: JsonPointer = '';

export function encodeSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function parsePointer(pointer: JsonPointer): string[] {
  if (pointer === '') {
    return [];
  }

  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer (must start with /): ${pointer}`);
  }

  return pointer.slice(1).split('/').map(decodeSegment);
}

export function buildPointer(segments: readonly (string | number)[]): JsonPointer {
  if (segments.length === 0) {
    return ROOT_POINTER;
  }

  return '/' + segments.map((segment) => encodeSegment(String(segment))).join('/');
}

export function appendPointer(
  pointer: JsonPointer,
  ...segments: readonly (string | number)[]
): JsonPointer {
  if (segments.length === 0) {
    return pointer;
  }

  const suffix = segments.map((segment) => encodeSegment(String(segment))).join('/');
  return pointer === '' ? '/' + suffix : pointer + '/' + suffix;
}

export function parentPointer(pointer: JsonPointer): JsonPointer | null {
  if (pointer === '') {
    return null;
  }

  const lastSlash = pointer.lastIndexOf('/');
  return lastSlash <= 0 ? ROOT_POINTER : pointer.slice(0, lastSlash);
}

export function lastSegment(pointer: JsonPointer): string | null {
  if (pointer === '') {
    return null;
  }

  const lastSlash = pointer.lastIndexOf('/');
  return decodeSegment(pointer.slice(lastSlash + 1));
}

/**
 * Read the value at `pointer` from `root`. Returns `undefined` if the path
 * cannot be resolved at any segment.
 */
export function getAt(root: unknown, pointer: JsonPointer): unknown {
  const segments = parsePointer(pointer);
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

/**
 * Apply `mutate` to the value at `pointer` inside an Immer draft. The parent
 * containers along the path must already exist; this helper does not create
 * intermediate objects. Returns true if the value was reached.
 */
export function updateAt(
  draft: Record<string, unknown> | unknown[],
  pointer: JsonPointer,
  mutate: (value: unknown, container: Record<string, unknown> | unknown[], key: string | number) => void,
): boolean {
  const segments = parsePointer(pointer);

  if (segments.length === 0) {
    return false;
  }

  let container: Record<string, unknown> | unknown[] = draft;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const next = Array.isArray(container)
      ? container[Number.parseInt(segment, 10)]
      : container[segment];

    if (next === null || typeof next !== 'object') {
      return false;
    }

    container = next as Record<string, unknown> | unknown[];
  }

  const lastSeg = segments[segments.length - 1];
  const key: string | number = Array.isArray(container) ? Number.parseInt(lastSeg, 10) : lastSeg;
  const current = Array.isArray(container) ? container[key as number] : container[key as string];

  mutate(current, container, key);
  return true;
}

/**
 * Resolve `pointer` against `root`. If the pointer cannot be resolved, walk
 * up segment-by-segment until a resolvable ancestor (or the root) is found.
 */
export function resolveOrAncestor(root: unknown, pointer: JsonPointer): JsonPointer {
  let current: JsonPointer | null = pointer;

  while (current !== null) {
    if (getAt(root, current) !== undefined) {
      return current;
    }

    current = parentPointer(current);
  }

  return ROOT_POINTER;
}
