import {
  VNEXT_WORKSPACE_RUNTIME_VERSION,
  VNEXT_WORKSPACE_SCHEMA_VERSION,
} from '@vnext-forge/app-contracts'
import { z } from 'zod'

import type { WorkspaceConfig, WorkspaceExports, WorkspacePaths } from '@workspace/types.js'

/** vnext.config.json için minimal doğrulama (durum + ağaç yönlendirmesi). */
export const workspaceRootConfigSchema = z
  .object({
    domain: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    runtimeVersion: z.string().optional(),
    schemaVersion: z.string().optional(),
    paths: z
      .object({
        componentsRoot: z.string().min(1).optional(),
        tasks: z.string().optional(),
        views: z.string().optional(),
        functions: z.string().optional(),
        extensions: z.string().optional(),
        workflows: z.string().optional(),
        schemas: z.string().optional(),
      })
      .optional(),
    exports: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
    referenceResolution: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export type WorkspaceRootConfigParsed = z.infer<typeof workspaceRootConfigSchema>

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function coerceExports(raw: unknown, domain: string): WorkspaceExports {
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
        ? (record.metadata as Record<string, unknown>)
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

/** Ayrıştırılmış kök dosyayı iç kullanım `WorkspaceConfig` şekline tamamlar. */
export function normalizeWorkspaceRootToConfig(parsed: WorkspaceRootConfigParsed): WorkspaceConfig {
  const domain = parsed.domain
  const p = parsed.paths ?? {}
  const paths: WorkspacePaths = {
    componentsRoot: p.componentsRoot ?? domain,
    tasks: p.tasks ?? 'Tasks',
    views: p.views ?? 'Views',
    functions: p.functions ?? 'Functions',
    extensions: p.extensions ?? 'Extensions',
    workflows: p.workflows ?? 'Workflows',
    schemas: p.schemas ?? 'Schemas',
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
        ? (parsed.referenceResolution as unknown as WorkspaceConfig['referenceResolution'])
        : undefined,
  }
}
