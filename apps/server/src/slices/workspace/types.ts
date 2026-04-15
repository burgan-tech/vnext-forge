import type { VnextWorkspaceConfig } from '@vnext-forge/vnext-types'

// Re-export canonical config types from vnext-types
export type {
  VnextWorkspaceConfig,
  VnextWorkspaceDependencies,
  VnextWorkspaceExports,
  VnextWorkspaceExportsMeta,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
} from '@vnext-forge/vnext-types'

// ── Server-only types ─────────────────────────────────────────────────────────

export interface SearchResult {
  path: string
  line: number
  text: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

export interface IWorkspace {
  rootPath: string
  config: VnextWorkspaceConfig
}

export interface WorkspaceMetadata {
  rootPath: string
  domain: string
  description?: string
  version: string
  runtimeVersion: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface WorkspaceStructure {
  root: FileTreeNode
}

export interface WorkspaceAnalysisResult {
  rootPath: string
  config: VnextWorkspaceConfig | null
  configValid: boolean
  tree: FileTreeNode
}
