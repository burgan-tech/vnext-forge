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

export interface WorkspacePaths {
  componentsRoot: string
  tasks: string
  views: string
  functions: string
  extensions: string
  workflows: string
  schemas: string
}

export interface WorkspaceExports {
  functions: string[]
  workflows: string[]
  tasks: string[]
  views: string[]
  schemas: string[]
  extensions: string[]
  visibility?: 'public' | 'private'
  metadata?: Record<string, unknown>
}

export interface WorkspaceDependencies {
  domains: string[]
  npm?: string[]
}

export interface ReferenceResolutionConfig {
  enabled: boolean
  validateOnBuild: boolean
  strictMode: boolean
  validateReferenceConsistency?: boolean
  validateSchemas?: boolean
  allowedHosts?: string[]
  schemaValidationRules?: {
    enforceKeyFormat?: boolean
    enforceVersionFormat?: boolean
    enforceFilenameConsistency?: boolean
    allowUnknownProperties?: boolean
  }
}

export interface WorkspaceConfig {
  domain: string
  description?: string
  version: string
  runtimeVersion: string
  schemaVersion: string
  paths: WorkspacePaths
  exports: WorkspaceExports
  dependencies: WorkspaceDependencies
  referenceResolution?: ReferenceResolutionConfig
}

export interface IWorkspace {
  rootPath: string
  config: WorkspaceConfig
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
  config: WorkspaceConfig | null
  configValid: boolean
  tree: FileTreeNode
}
