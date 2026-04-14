/**
 * Merkezi vNext workspace (vnext.config.json) varsayılanları.
 * Sürüm değerleri tek kaynakta tutulur; runtime / şema hizası buradan yönetilir.
 */
export const VNEXT_WORKSPACE_RUNTIME_VERSION = '0.0.33' as const
export const VNEXT_WORKSPACE_SCHEMA_VERSION = '0.0.33' as const

export const VNEXT_WORKSPACE_CONFIG_VERSION = '1.0.0' as const

export interface VnextWorkspacePathsJson {
  componentsRoot: string
  tasks: string
  views: string
  functions: string
  extensions: string
  workflows: string
  schemas: string
}

export interface VnextWorkspaceExportsMetadataJson {
  description: string
  maintainer: string
  license: string
  keywords: string[]
}

export interface VnextWorkspaceExportsJson {
  functions: string[]
  workflows: string[]
  tasks: string[]
  views: string[]
  schemas: string[]
  extensions: string[]
  visibility: 'public' | 'private'
  metadata: VnextWorkspaceExportsMetadataJson
}

export interface VnextWorkspaceReferenceResolutionJson {
  enabled: boolean
  validateOnBuild: boolean
  strictMode: boolean
  validateReferenceConsistency: boolean
  validateSchemas: boolean
  allowedHosts: string[]
  schemaValidationRules: {
    enforceKeyFormat: boolean
    enforceVersionFormat: boolean
    enforceFilenameConsistency: boolean
    allowUnknownProperties: boolean
  }
}

/** vnext.config.json ile uyumlu tam yapı (sunucu / istemci yazımı için). */
export interface VnextWorkspaceConfigJson {
  version: string
  description: string
  domain: string
  runtimeVersion: string
  schemaVersion: string
  paths: VnextWorkspacePathsJson
  exports: VnextWorkspaceExportsJson
  dependencies: {
    domains: string[]
    npm: string[]
  }
  referenceResolution: VnextWorkspaceReferenceResolutionJson
}

export interface BuildVnextWorkspaceConfigInput {
  domain: string
  /** Kök config açıklaması (zorunlu kullanıcı girdisi). */
  description: string
  /** exports.metadata.description (zorunlu kullanıcı girdisi). */
  exportsMetadataDescription: string
  exportsMetadataMaintainer?: string
  exportsMetadataLicense?: string
  exportsMetadataKeywords?: string[]
  /**
   * Açıkça verilirse domain ile senkron güncellenmez (kullanıcı özelleştirmiş kabul edilir).
   */
  componentsRoot?: string
  runtimeVersion?: string
  schemaVersion?: string
  configVersion?: string
}

const DEFAULT_PATH_SEGMENTS = {
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Workflows',
  schemas: 'Schemas',
} as const

const DEFAULT_REFERENCE_RESOLUTION: VnextWorkspaceReferenceResolutionJson = {
  enabled: true,
  validateOnBuild: true,
  strictMode: true,
  validateReferenceConsistency: true,
  validateSchemas: true,
  allowedHosts: ['registry.npmjs.org', 'npm.vnext.com', 'npm.pkg.github.com'],
  schemaValidationRules: {
    enforceKeyFormat: true,
    enforceVersionFormat: true,
    enforceFilenameConsistency: true,
    allowUnknownProperties: false,
  },
}

/**
 * Wizard / sunucu tarafında vnext.config.json üretimi.
 */
export function buildVnextWorkspaceConfig(
  input: BuildVnextWorkspaceConfigInput,
): VnextWorkspaceConfigJson {
  const domain = input.domain.trim()
  const componentsRoot = (input.componentsRoot ?? domain).trim()

  const metadata: VnextWorkspaceExportsMetadataJson = {
    description: input.exportsMetadataDescription.trim(),
    maintainer: input.exportsMetadataMaintainer?.trim() || 'vNext Team',
    license: input.exportsMetadataLicense?.trim() || 'MIT',
    keywords:
      input.exportsMetadataKeywords && input.exportsMetadataKeywords.length > 0
        ? input.exportsMetadataKeywords.map((k) => k.trim()).filter(Boolean)
        : [domain, 'vnext', 'workflow', 'domain'],
  }

  return {
    version: input.configVersion ?? VNEXT_WORKSPACE_CONFIG_VERSION,
    description: input.description.trim(),
    domain,
    runtimeVersion: input.runtimeVersion ?? VNEXT_WORKSPACE_RUNTIME_VERSION,
    schemaVersion: input.schemaVersion ?? VNEXT_WORKSPACE_SCHEMA_VERSION,
    paths: {
      componentsRoot,
      tasks: DEFAULT_PATH_SEGMENTS.tasks,
      views: DEFAULT_PATH_SEGMENTS.views,
      functions: DEFAULT_PATH_SEGMENTS.functions,
      extensions: DEFAULT_PATH_SEGMENTS.extensions,
      workflows: DEFAULT_PATH_SEGMENTS.workflows,
      schemas: DEFAULT_PATH_SEGMENTS.schemas,
    },
    exports: {
      functions: [],
      workflows: [],
      tasks: [],
      views: [],
      schemas: [],
      extensions: [],
      visibility: 'public',
      metadata,
    },
    dependencies: {
      domains: [],
      npm: [],
    },
    referenceResolution: { ...DEFAULT_REFERENCE_RESOLUTION },
  }
}
