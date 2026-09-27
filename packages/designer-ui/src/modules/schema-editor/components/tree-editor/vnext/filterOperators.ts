/**
 * `x-filterOperators` spellings the runtime matches. The runtime maps the wire
 * operator of a filter (`ge`, `like`, …) to its schema spelling
 * (`SchemaFilterContext.ToSchemaOperator`) and looks it up case-insensitively in
 * this list, so only these spellings grant a filter. Grouped by category for the
 * picker only — persisted strings are the bare values.
 *
 * Decision D7: Forge writes these spellings and never drops a value it does not
 * know.
 */
export const FILTER_OPERATORS = [
  { value: 'eq', category: 'Equality' },
  { value: 'neq', category: 'Equality' },
  { value: 'gt', category: 'Comparison' },
  { value: 'gte', category: 'Comparison' },
  { value: 'lt', category: 'Comparison' },
  { value: 'lte', category: 'Comparison' },
  { value: 'between', category: 'Comparison' },
  { value: 'contains', category: 'Text' },
  { value: 'startsWith', category: 'Text' },
  { value: 'endsWith', category: 'Text' },
  { value: 'in', category: 'Membership' },
  { value: 'nin', category: 'Membership' },
  { value: 'includes', category: 'Membership' },
  { value: 'isNull', category: 'Presence' },
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];
export type FilterOperatorCategory = (typeof FILTER_OPERATORS)[number]['category'];

export const FILTER_OPERATOR_CATEGORIES: readonly FilterOperatorCategory[] = [
  'Equality',
  'Comparison',
  'Text',
  'Membership',
  'Presence',
];

/** Spellings of the old view vocabulary enum → runtime spelling. */
export const LEGACY_OPERATOR_ALIASES: Readonly<Record<string, FilterOperator>> = {
  ne: 'neq',
  ge: 'gte',
  le: 'lte',
  like: 'contains',
  match: 'contains',
  startswith: 'startsWith',
  endswith: 'endsWith',
  isnull: 'isNull',
};

const BY_LOWERCASE: ReadonlyMap<string, FilterOperator> = new Map<string, FilterOperator>([
  ...FILTER_OPERATORS.map((o): [string, FilterOperator] => [o.value.toLowerCase(), o.value]),
  ...Object.entries(LEGACY_OPERATOR_ALIASES),
]);

/** Runtime spelling for `raw` (exact, case-insensitive or legacy alias), or `null` when unknown. */
export function normalizeOperator(raw: string): FilterOperator | null {
  return BY_LOWERCASE.get(raw.trim().toLowerCase()) ?? null;
}

export interface LegacySpelling {
  raw: string;
  normalized: FilterOperator;
}

export interface SplitOperators {
  /** Runtime spellings in authored order, deduplicated. */
  known: FilterOperator[];
  /** Values Forge does not know, verbatim — they survive every edit. */
  unknown: string[];
  /** Authored values that were respelled for display (rewritten on the next edit). */
  legacy: LegacySpelling[];
}

/**
 * Split an authored `x-filterOperators` value for display. Nothing is written:
 * callers persist {@link mergeOperators} only after a user edit.
 */
export function splitOperators(value: unknown): SplitOperators {
  const known: FilterOperator[] = [];
  const unknown: string[] = [];
  const legacy: LegacySpelling[] = [];
  if (!Array.isArray(value)) return { known, unknown, legacy };
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeOperator(item);
    if (normalized === null) {
      if (!unknown.includes(item)) unknown.push(item);
      continue;
    }
    if (normalized !== item) legacy.push({ raw: item, normalized });
    if (!known.includes(normalized)) known.push(normalized);
  }
  return { known, unknown, legacy };
}

/** Runtime spellings in canonical order, followed by preserved unknown values. */
export function mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[] {
  return [...FILTER_OPERATORS.filter((o) => selected.has(o.value)).map((o) => o.value), ...unknown];
}
