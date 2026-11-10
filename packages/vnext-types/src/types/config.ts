/** Canonical vnext.config.json domain types. Single source of truth for all layers. */

export interface VnextWorkspacePaths {
  componentsRoot: string
  tasks: string
  views: string
  functions: string
  extensions: string
  workflows: string
  schemas: string
  mappings: string
  /** `sys-agents` folder (runtime 0.0.105). Optional: older solutions have none; Forge then uses `Agents`. */
  agents?: string
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
  mappings: string[]
  agents?: string[]
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
