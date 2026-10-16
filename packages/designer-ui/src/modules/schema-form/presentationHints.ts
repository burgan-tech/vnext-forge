/**
 * vnext-schema 0.0.56 form hints the QuickRun form honours: `x-order` (lower
 * first; fields without it keep their order after the ordered ones) and
 * `x-helpText` (shown when the field has no `description`).
 */

/** Property entries sorted by `x-order`, stable for equal / missing orders. */
export function orderedPropertyEntries<T>(properties: Record<string, T>): [string, T][] {
  const entries = Object.entries(properties);
  const orderOf = (value: T): number => {
    const order = value && typeof value === 'object' ? (value as Record<string, unknown>)['x-order'] : undefined;
    return typeof order === 'number' && Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
  };
  return entries
    .map((entry, index) => ({ entry, index, order: orderOf(entry[1]) }))
    .sort((a, b) => (a.order === b.order ? a.index - b.index : a.order - b.order))
    .map(({ entry }) => entry);
}

/** `description`, else the `x-helpText` entry for English (or the first one). */
export function fieldHelpText(prop: Record<string, unknown>): string | undefined {
  if (typeof prop.description === 'string' && prop.description !== '') return prop.description;
  const help = prop['x-helpText'];
  if (!help || typeof help !== 'object' || Array.isArray(help)) return undefined;
  const map = help as Record<string, unknown>;
  const text = typeof map.en === 'string' && map.en !== '' ? map.en : Object.values(map).find((v) => typeof v === 'string' && v !== '');
  return typeof text === 'string' ? text : undefined;
}
