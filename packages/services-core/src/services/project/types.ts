import type { VnextWorkspaceConfig } from '../workspace/types.js'

export interface ProjectEntry {
  id: string
  domain: string
  description?: string
  path: string
  version?: string
  workflowCount?: number
  linked?: boolean
  /**
   * Solution file this project reads (`vnext.<domain>.config.json`). Absent for
   * the default `vnext.config.json` so single-domain workspaces are unchanged.
   */
  configFileName?: string
}

export interface LinkFile {
  sourcePath: string
  domain: string
  importedAt: string
  /** Solution file inside `sourcePath`; absent = default `vnext.config.json`. */
  configFileName?: string
}

export type ProjectConfigStatus =
  | { status: 'ok'; config: VnextWorkspaceConfig }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

export interface SeedVnextComponentLayoutResult {
  ensuredPaths: string[]
}

export interface VnextComponentLayoutStatusResult {
  projectContainsOnlyConfigFile: boolean
  componentsRootPresent: boolean
  missingLayoutPaths: string[]
  layoutComplete: boolean
}

export type ComponentFileTypeMap = Record<string, string>
