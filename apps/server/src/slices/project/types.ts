import type { VnextWorkspaceConfig } from '@workspace/types.js'

export interface ProjectEntry {
  id: string
  domain: string
  description?: string
  path: string
  version?: string
  workflowCount?: number
  linked?: boolean
}

export interface LinkFile {
  sourcePath: string
  domain: string
  importedAt: string
}

export type ProjectConfigStatus =
  | { status: 'ok'; config: VnextWorkspaceConfig }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

/** POST /projects/:id/vnextComponentLayout — mkdir ile güvence altına alınan yollar (proje köküne göre, `/` ile). */
export interface SeedVnextComponentLayoutResult {
  ensuredPaths: string[]
}

/** GET /projects/:id/vnextComponentLayoutStatus — şablon diyalog tetiklemesi için disk kontrolü. */
export interface VnextComponentLayoutStatusResult {
  /** Proje kökünde tek dosya: vnext.config.json */
  projectContainsOnlyConfigFile: boolean
  /** paths.componentsRoot diskte klasör olarak var mı */
  componentsRootPresent: boolean
  /** Beklenen layout yollarından eksik veya dosya olarak var olanlar (posix, proje köküne göre) */
  missingLayoutPaths: string[]
  /** Tüm beklenen dizinler mevcut ve klasör */
  layoutComplete: boolean
}
