import type { VnextWorkspaceConfig } from '../workspace/types.js'

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
