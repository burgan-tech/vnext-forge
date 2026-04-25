/**
 * vNext bileşen JSON keşfi (task, workflow, schema, …) — BFF ve istemci arasında paylaşılan satır tipleri.
 */

export const VNEXT_EXPORT_CATEGORIES = [
  'workflows',
  'tasks',
  'schemas',
  'views',
  'functions',
  'extensions',
] as const

export type VnextExportCategory = (typeof VNEXT_EXPORT_CATEGORIES)[number]

/** vNext JSON `flow` → vnext.config `exports` kategorisi. */
export const VNEXT_FLOW_TO_EXPORT_CATEGORY: Record<string, VnextExportCategory> = {
  'sys-flows': 'workflows',
  'sys-tasks': 'tasks',
  'sys-schemas': 'schemas',
  'sys-views': 'views',
  'sys-functions': 'functions',
  'sys-extensions': 'extensions',
}

export interface DiscoveredVnextComponent {
  key: string
  path: string
  flow: string
  version?: string
}

export type VnextComponentsByCategory = Record<VnextExportCategory, DiscoveredVnextComponent[]>

export interface VnextComponentsDiscoveryResult {
  components: VnextComponentsByCategory
}
