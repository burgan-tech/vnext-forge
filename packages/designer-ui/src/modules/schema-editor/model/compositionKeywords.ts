/**
 * JSON Schema composition keywords. `allOf`, `anyOf`, `oneOf` take an array
 * of subschemas; `not` takes a single subschema.
 */

export const ARRAY_COMPOSITION_KEYWORDS = ['allOf', 'anyOf', 'oneOf'] as const;

export type ArrayCompositionKeyword = (typeof ARRAY_COMPOSITION_KEYWORDS)[number];

export const COMPOSITION_KEYWORDS = [...ARRAY_COMPOSITION_KEYWORDS, 'not'] as const;

export type CompositionKeyword = (typeof COMPOSITION_KEYWORDS)[number];

export function isCompositionKeyword(key: string): key is CompositionKeyword {
  return (COMPOSITION_KEYWORDS as readonly string[]).includes(key);
}

export function isArrayCompositionKeyword(key: string): key is ArrayCompositionKeyword {
  return (ARRAY_COMPOSITION_KEYWORDS as readonly string[]).includes(key);
}

/**
 * Count of subschemas under a composition keyword on a node, or 0 if the
 * keyword is absent / not in the expected shape.
 */
export function countCompositionItems(
  node: Record<string, unknown> | undefined,
  keyword: CompositionKeyword,
): number {
  if (!node) {
    return 0;
  }

  const value = node[keyword];

  if (keyword === 'not') {
    return value && typeof value === 'object' ? 1 : 0;
  }

  return Array.isArray(value) ? value.length : 0;
}
