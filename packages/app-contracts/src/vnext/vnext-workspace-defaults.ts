/**
 * Merkezi vNext workspace (vnext.config.json) varsayılanları.
 * Sürüm değerleri tek kaynakta tutulur; runtime / şema hizası buradan yönetilir.
 *
 * Kanonik tip tanımları `@vnext-forge/vnext-types` paketinde yaşar.
 * Bu dosya yalnızca versiyon sabitleri, builder girdisi ve builder fonksiyonunu barındırır.
 */
import type {
  VnextWorkspaceConfig,
  VnextWorkspaceExportsMeta,
  VnextWorkspaceReferenceResolution,
} from '@vnext-forge/vnext-types'

export type {
  VnextWorkspaceConfig,
  VnextWorkspaceDependencies,
  VnextWorkspaceExports,
  VnextWorkspaceExportsMeta,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
} from '@vnext-forge/vnext-types'

// ── Version constants ─────────────────────────────────────────────────────────

export const VNEXT_WORKSPACE_RUNTIME_VERSION = '0.0.33' as const
export const VNEXT_WORKSPACE_SCHEMA_VERSION = '0.0.33' as const

export const VNEXT_WORKSPACE_CONFIG_VERSION = '1.0.0' as const

// ── Builder input ─────────────────────────────────────────────────────────────

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

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PATH_SEGMENTS = {
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Workflows',
  schemas: 'Schemas',
} as const

const DEFAULT_REFERENCE_RESOLUTION: Required<VnextWorkspaceReferenceResolution> = {
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

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Wizard / sunucu tarafında vnext.config.json üretimi.
 * Her zaman tam dolu bir config döner (description, referenceResolution dahil).
 */
export function buildVnextWorkspaceConfig(
  input: BuildVnextWorkspaceConfigInput,
): VnextWorkspaceConfig {
  const domain = input.domain.trim()
  const componentsRoot = (input.componentsRoot ?? domain).trim()

  const metadata: Required<VnextWorkspaceExportsMeta> = {
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
