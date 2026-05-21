/**
 * Allow-list of JSON Schema keywords the new editor renders with first-class
 * UI. Keys not in this list (and not starting with `x-`) appear in the raw
 * passthrough fallback so they roundtrip without loss.
 */

export const RECOGNIZED_KEYWORDS = new Set<string>([
  // identity / metadata
  '$id',
  '$schema',
  '$ref',
  '$defs',
  'definitions',
  'title',
  'description',
  'examples',
  'readOnly',
  'writeOnly',
  'deprecated',
  // type model
  'type',
  'const',
  'default',
  'enum',
  // string
  'minLength',
  'maxLength',
  'pattern',
  'format',
  // number
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  // object
  'properties',
  'required',
  'additionalProperties',
  'patternProperties',
  'dependentRequired',
  'dependentSchemas',
  'minProperties',
  'maxProperties',
  // array
  'items',
  'prefixItems',
  'contains',
  'minItems',
  'maxItems',
  'uniqueItems',
  // composition
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
]);

export const RECOGNIZED_VNEXT_KEYWORDS = new Set<string>([
  'x-labels',
  'x-enum',
  'x-errorMessages',
  'x-conditional',
  'x-lov',
  'x-lookup',
  'x-binding',
  'x-encryption',
  'x-validation',
]);

export function isRecognizedKeyword(key: string): boolean {
  return RECOGNIZED_KEYWORDS.has(key) || RECOGNIZED_VNEXT_KEYWORDS.has(key);
}

/**
 * Returns the keys on `node` that are neither standard JSON Schema keywords
 * the editor knows nor known vNext extensions. These are rendered through
 * `RawJsonFallback` so they survive a save.
 */
export function getUnknownKeywords(node: Record<string, unknown> | undefined | null): string[] {
  if (!node) {
    return [];
  }

  return Object.keys(node).filter((key) => !isRecognizedKeyword(key));
}
