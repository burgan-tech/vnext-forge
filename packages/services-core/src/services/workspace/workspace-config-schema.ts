import {
  VNEXT_WORKSPACE_RUNTIME_VERSION,
  VNEXT_WORKSPACE_SCHEMA_VERSION,
} from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type {
  VnextWorkspaceConfig,
  VnextWorkspaceExports,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
} from './types.js'

const requiredField = (label: string) =>
  z.string({ message: `"${label}" alanı zorunludur.` }).min(1, `"${label}" boş olamaz.`)

/**
 * Lenient zod schema for the on-disk vnext.config.json. Used by `workspace`
 * service to grade the config as ok | missing | invalid before delegating to
 * the strict normalizer below. This schema lives in services-core because the
 * same parsing is needed by both the web-server transport and the extension
 * MessageRouter dispatch path.
 */
export const workspaceRootConfigSchema = z
  .object({
    domain: requiredField('domain'),
    version: requiredField('version'),
    description: z.string().optional(),
    runtimeVersion: requiredField('runtimeVersion').optional(),
    schemaVersion: requiredField('schemaVersion').optional(),
    paths: z.object({
      componentsRoot: requiredField('paths.componentsRoot'),
      tasks: requiredField('paths.tasks'),
      views: requiredField('paths.views'),
      functions: requiredField('paths.functions'),
      extensions: requiredField('paths.extensions'),
      workflows: requiredField('paths.workflows'),
      schemas: requiredField('paths.schemas'),
    }),
    exports: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
    referenceResolution: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export type WorkspaceRootConfigParsed = z.infer<typeof workspaceRootConfigSchema>

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function coerceExports(raw: unknown, domain: string): VnextWorkspaceExports {
  if (!raw || typeof raw !== 'object') {
    return {
      functions: [],
      workflows: [],
      tasks: [],
      views: [],
      schemas: [],
      extensions: [],
      visibility: 'public',
      metadata: { description: `Exported components for ${domain}` },
    }
  }
  const record = raw as Record<string, unknown>
  return {
    functions: asStringArray(record.functions),
    workflows: asStringArray(record.workflows),
    tasks: asStringArray(record.tasks),
    views: asStringArray(record.views),
    schemas: asStringArray(record.schemas),
    extensions: asStringArray(record.extensions),
    visibility: record.visibility === 'private' ? 'private' : 'public',
    metadata:
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as VnextWorkspaceExports['metadata'])
        : { description: `Exported components for ${domain}` },
  }
}

function coerceDependencies(raw: unknown): { domains: string[]; npm?: string[] } {
  if (!raw || typeof raw !== 'object') {
    return { domains: [], npm: [] }
  }
  const record = raw as Record<string, unknown>
  return {
    domains: asStringArray(record.domains),
    npm: asStringArray(record.npm),
  }
}

export function normalizeWorkspaceRootToConfig(parsed: WorkspaceRootConfigParsed): VnextWorkspaceConfig {
  const domain = parsed.domain
  const p = parsed.paths
  const paths: VnextWorkspacePaths = {
    componentsRoot: p.componentsRoot,
    tasks: p.tasks,
    views: p.views,
    functions: p.functions,
    extensions: p.extensions,
    workflows: p.workflows,
    schemas: p.schemas,
  }

  return {
    version: parsed.version,
    description: parsed.description,
    domain,
    runtimeVersion: parsed.runtimeVersion ?? VNEXT_WORKSPACE_RUNTIME_VERSION,
    schemaVersion: parsed.schemaVersion ?? VNEXT_WORKSPACE_SCHEMA_VERSION,
    paths,
    exports: coerceExports(parsed.exports, domain),
    dependencies: coerceDependencies(parsed.dependencies),
    referenceResolution:
      parsed.referenceResolution && typeof parsed.referenceResolution === 'object'
        ? (parsed.referenceResolution as unknown as VnextWorkspaceReferenceResolution)
        : undefined,
  }
}
