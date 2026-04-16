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

/** POST /projects/:id/vnextComponentLayout — vnext-template ile proje yapısı oluşturma sonucu. */
export interface SeedVnextComponentLayoutResult {
  ensuredPaths: string[]
}

/** GET /projects/:id/vnextComponentLayoutStatus — şablon diyalog tetiklemesi için disk kontrolü. */
export interface VnextComponentLayoutStatusResult {
  /** Proje kökünde tek dosya: vnext.config.json */
  projectContainsOnlyConfigFile: boolean
  /** paths.componentsRoot diskte klasör olarak var mı */
  componentsRootPresent: boolean
  /** Eksik bileşen klasörleri ve şablon dosyaları (posix, proje köküne göre) */
  missingLayoutPaths: string[]
  /** Tüm beklenen klasörler ve dosyalar mevcut */
  layoutComplete: boolean
}

/** GET /projects/:id/componentFileTypes — componentsRoot altındaki .json dosyalarının flow alanına göre tip haritası. */
export type ComponentFileTypeMap = Record<string, string>
