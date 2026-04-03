export interface WorkspacePaths {
  componentsRoot: string
  tasks: string
  views: string
  functions: string
  extensions: string
  workflows: string
  schemas: string
  mappings: string
}

export interface WorkspaceExports {
  functions: string[]
  workflows: string[]
  tasks: string[]
  views: string[]
  schemas: string[]
  extensions: string[]
  visibility: 'private' | 'public'
  metadata: Record<string, unknown>
}

export interface WorkspaceDependencies {
  domains: string[]
  npm: string[]
}

export interface ReferenceResolutionConfig {
  enabled: boolean
  validateOnBuild: boolean
  strictMode: boolean
}

export interface WorkspaceConfig {
  version: string
  domain: string
  description?: string
  runtimeVersion: string
  schemaVersion: string
  paths: WorkspacePaths
  exports: WorkspaceExports
  dependencies: WorkspaceDependencies
  referenceResolution: ReferenceResolutionConfig
}

export interface IWorkspace {
  domain: string
  description?: string
  rootPath: string
  version?: string
  config?: WorkspaceConfig
}

export interface WorkspaceMetadata {
  domain: string
  description?: string
  version?: string
}
