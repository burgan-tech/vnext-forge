/** Canonical vnext.config.json domain types. Single source of truth for all layers. */

export interface VnextWorkspacePaths {
  componentsRoot: string
  tasks: string
  views: string
  functions: string
  extensions: string
  workflows: string
  schemas: string
}

export interface VnextWorkspaceExportsMeta {
  description: string
  maintainer?: string
  license?: string
  keywords?: string[]
}

export interface VnextWorkspaceExports {
  functions: string[]
  workflows: string[]
  tasks: string[]
  views: string[]
  schemas: string[]
  extensions: string[]
  visibility: 'public' | 'private'
  metadata: VnextWorkspaceExportsMeta
}

export interface VnextWorkspaceDependencies {
  domains: string[]
  npm?: string[]
}

export interface VnextWorkspaceReferenceResolution {
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

export interface VnextWorkspaceConfig {
  version: string
  description?: string
  domain: string
  runtimeVersion: string
  schemaVersion: string
  paths: VnextWorkspacePaths
  exports: VnextWorkspaceExports
  dependencies: VnextWorkspaceDependencies
  referenceResolution?: VnextWorkspaceReferenceResolution
}
