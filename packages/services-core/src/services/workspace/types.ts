import type { VnextWorkspaceConfig } from '@vnext-forge/vnext-types'

export type {
  VnextWorkspaceConfig,
  VnextWorkspaceDependencies,
  VnextWorkspaceExports,
  VnextWorkspaceExportsMeta,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
} from '@vnext-forge/vnext-types'

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

export type WorkspaceConfigReadStatus =
  | { status: 'ok'; config: VnextWorkspaceConfig }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }
