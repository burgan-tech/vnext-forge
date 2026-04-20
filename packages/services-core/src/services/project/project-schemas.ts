import { z } from 'zod'

const invalidPathCharacterPattern = /[\\/:*?"<>|]/
const windowsReservedNamePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export const projectDomainSchema = z
  .string()
  .trim()
  .min(1, 'Project domain is required')
  .refine((v) => v !== '.' && v !== '..', 'This project domain is not allowed.')
  .refine(
    (v) => !invalidPathCharacterPattern.test(v),
    'Use a project domain without path separators or reserved characters.',
  )
  .refine((v) => !windowsReservedNamePattern.test(v), 'This project domain is reserved by Windows.')

const stringArraySchema = z.array(z.string())

export const vnextWorkspaceFullConfigSchema = z.object({
  version: z.string().min(1),
  description: z.string().min(1),
  domain: projectDomainSchema,
  runtimeVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  paths: z.object({
    componentsRoot: z.string().min(1),
    tasks: z.string(),
    views: z.string(),
    functions: z.string(),
    extensions: z.string(),
    workflows: z.string(),
    schemas: z.string(),
  }),
  exports: z.object({
    functions: stringArraySchema,
    workflows: stringArraySchema,
    tasks: stringArraySchema,
    views: stringArraySchema,
    schemas: stringArraySchema,
    extensions: stringArraySchema,
    visibility: z.enum(['public', 'private']),
    metadata: z.object({
      description: z.string().min(1),
      maintainer: z.string(),
      license: z.string(),
      keywords: stringArraySchema,
    }),
  }),
  dependencies: z.object({
    domains: stringArraySchema,
    npm: stringArraySchema,
  }),
  referenceResolution: z.object({
    enabled: z.boolean(),
    validateOnBuild: z.boolean(),
    strictMode: z.boolean(),
    validateReferenceConsistency: z.boolean(),
    validateSchemas: z.boolean(),
    allowedHosts: stringArraySchema,
    schemaValidationRules: z.object({
      enforceKeyFormat: z.boolean(),
      enforceVersionFormat: z.boolean(),
      enforceFilenameConsistency: z.boolean(),
      allowUnknownProperties: z.boolean(),
    }),
  }),
})

const projectIdParam = z.object({ id: z.string().min(1, 'Project id is required') })

// ── Method-level zod params/results (consumed by methodRegistry) ─────────────

export const projectsListParams = z.object({}).optional().transform(() => ({}))
export const projectEntryShape = z.object({
  id: z.string(),
  domain: z.string(),
  description: z.string().optional(),
  path: z.string(),
  version: z.string().optional(),
  workflowCount: z.number().int().optional(),
  linked: z.boolean().optional(),
})
export const projectsListResult = z.array(projectEntryShape)

export const projectsGetByIdParams = projectIdParam
export const projectsGetByIdResult = projectEntryShape

export const projectsCreateParams = z.object({
  domain: projectDomainSchema,
  description: z.string().optional(),
  targetPath: z.string().trim().min(1).optional(),
})
export const projectsCreateResult = projectEntryShape

export const projectsImportParams = z.object({
  path: z.string().min(1, 'Project path is required'),
})
export const projectsImportResult = projectEntryShape

export const projectsRemoveParams = projectIdParam
export const projectsRemoveResult = z.object({ success: z.boolean() })

export const projectsExportParams = projectIdParam.extend({
  targetPath: z.string().min(1, 'Export targetPath is required'),
})
export const projectsExportResult = z.object({ success: z.literal(true), exportPath: z.string() })

export const projectsGetTreeParams = projectIdParam
const fileTreeNodeShape: z.ZodType<{
  name: string
  path: string
  type: 'file' | 'directory'
  children?: Array<{ name: string; path: string; type: 'file' | 'directory'; children?: unknown }>
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'directory']),
    children: z.array(fileTreeNodeShape).optional(),
  }),
)
export const projectsGetTreeResult = z.object({ root: fileTreeNodeShape })

export const projectsGetConfigParams = projectIdParam
export const projectsGetConfigResult = z.unknown()

export const projectsGetConfigStatusParams = projectIdParam
export const projectsGetConfigStatusResult = z.union([
  z.object({ status: z.literal('ok'), config: z.unknown() }),
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.literal('invalid'), message: z.string() }),
])

export const projectsWriteConfigParams = projectIdParam.extend({
  config: vnextWorkspaceFullConfigSchema,
})
export const projectsWriteConfigResult = projectEntryShape

export const projectsGetVnextComponentLayoutStatusParams = projectIdParam
export const projectsGetVnextComponentLayoutStatusResult = z.object({
  projectContainsOnlyConfigFile: z.boolean(),
  componentsRootPresent: z.boolean(),
  missingLayoutPaths: z.array(z.string()),
  layoutComplete: z.boolean(),
})

export const projectsSeedVnextComponentLayoutParams = projectIdParam
export const projectsSeedVnextComponentLayoutResult = z.object({
  ensuredPaths: z.array(z.string()),
})

export const projectsGetValidateScriptStatusParams = projectIdParam
export const projectsGetValidateScriptStatusResult = z.object({ exists: z.boolean() })

export const projectsGetComponentFileTypesParams = projectIdParam
export const projectsGetComponentFileTypesResult = z.record(z.string(), z.string())

// Aggregated bootstrap payload (single RPC for opening a project workspace).
// Cheap fields are always set; expensive ones are nullable and only populated
// when `configStatus.status === 'ok'`.
export const projectsGetWorkspaceBootstrapParams = projectIdParam
export const projectsGetWorkspaceBootstrapResult = z.object({
  project: projectEntryShape,
  tree: projectsGetTreeResult,
  configStatus: projectsGetConfigStatusResult,
  layoutStatus: projectsGetVnextComponentLayoutStatusResult.nullable(),
  validateScriptStatus: projectsGetValidateScriptStatusResult.nullable(),
  componentFileTypes: projectsGetComponentFileTypesResult.nullable(),
})
