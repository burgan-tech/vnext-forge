/**
 * Vocab enum (mirrors `view-vocab.json#x-filterOperators.items.enum`).
 * Grouped by category for the picker UI only — persisted strings are
 * the bare enum values.
 *
 * Type / operator compatibility is enforced by the server (e.g.
 * `string + gt/lt/ge/le/between` → date compare; `boolean` → equality
 * only). The editor lists every operator; authors pick the subset
 * that applies to their field's type.
 *
 * Phase D4 replaces this operator list with the runtime spellings.
 */
export const FILTER_OPERATORS = [
  { value: 'eq', category: 'Equality' },
  { value: 'ne', category: 'Equality' },
  { value: 'gt', category: 'Comparison' },
  { value: 'ge', category: 'Comparison' },
  { value: 'lt', category: 'Comparison' },
  { value: 'le', category: 'Comparison' },
  { value: 'between', category: 'Comparison' },
  { value: 'match', category: 'Text' },
  { value: 'like', category: 'Text' },
  { value: 'startswith', category: 'Text' },
  { value: 'endswith', category: 'Text' },
  { value: 'in', category: 'Membership' },
  { value: 'nin', category: 'Membership' },
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];

const FILTER_OPERATOR_SET: ReadonlySet<string> = new Set(
  FILTER_OPERATORS.map((o) => o.value),
);

/**
 * Split an authored `x-filterOperators` value. Operators outside
 * {@link FILTER_OPERATORS} are kept verbatim in `unknown` — they may be
 * spellings the runtime accepts (e.g. `gte`, `contains`) and must survive an
 * edit of the known ones.
 */
export function splitOperators(value: unknown): { known: FilterOperator[]; unknown: string[] } {
  const known: FilterOperator[] = [];
  const unknown: string[] = [];
  if (!Array.isArray(value)) return { known, unknown };
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || seen.has(item)) continue;
    seen.add(item);
    if (FILTER_OPERATOR_SET.has(item)) known.push(item as FilterOperator);
    else unknown.push(item);
  }
  return { known, unknown };
}

/** Known operators in canonical order, followed by preserved unknown ones. */
export function mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[] {
  return [...FILTER_OPERATORS.filter((o) => selected.has(o.value)).map((o) => o.value), ...unknown];
}
