import type { DiscoveredVnextComponent, VnextExportCategory } from '@vnext-forge-studio/app-contracts';

/** Categories a monitor reference can point at. */
export const MONITOR_LINK_CATEGORIES = [
  'workflows',
  'tasks',
  'views',
  'schemas',
  'functions',
  'extensions',
] as const satisfies readonly VnextExportCategory[];

export type ComponentIndex = Partial<Record<VnextExportCategory, ReadonlyMap<string, string>>>;

/** key → file path per category; the first file wins, as in `useWorkflowFileResolver`. */
export function buildComponentIndex(
  entries: readonly (readonly [VnextExportCategory, readonly DiscoveredVnextComponent[]])[],
): ComponentIndex {
  const index: ComponentIndex = {};
  for (const [category, components] of entries) {
    const byKey = new Map<string, string>();
    for (const c of components) if (!byKey.has(c.key)) byKey.set(c.key, c.path);
    index[category] = byKey;
  }
  return index;
}

/** A path; `null` when the category is loaded without that key; `undefined` while it is still loading. */
export function lookupComponent(index: ComponentIndex, category: VnextExportCategory, key: string): string | null | undefined {
  const byKey = index[category];
  if (!byKey) return undefined;
  return byKey.get(key) ?? null;
}
