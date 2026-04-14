import { z } from 'zod'

const invalidPathCharacterPattern = /[\\/:*?"<>|]/
const windowsReservedNamePattern =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

const projectDomainSchema = z
  .string()
  .trim()
  .min(1, 'Project domain is required')
  .refine((value) => value !== '.' && value !== '..', 'This project domain is not allowed.')
  .refine(
    (value) => !invalidPathCharacterPattern.test(value),
    'Use a project domain without path separators or reserved characters.',
  )
  .refine(
    (value) => !windowsReservedNamePattern.test(value),
    'This project domain is reserved by Windows.',
  )

const projectIdSchema = z.object({
  id: z.string().min(1, 'Project id is required'),
})

export const projectCreateRequestSchema = {
  json: z.object({
    domain: projectDomainSchema,
    description: z.string().optional(),
    targetPath: z.string().trim().min(1).optional(),
  }),
}

export const projectByIdRequestSchema = {
  params: projectIdSchema,
}

export const projectImportRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'Project path is required'),
  }),
}

export const projectExportRequestSchema = {
  params: projectIdSchema,
  json: z.object({
    targetPath: z.string().min(1, 'Export targetPath is required'),
  }),
}

const stringArraySchema = z.array(z.string())

/** Tam vnext.config.json gövdesi (POST /projects/:id/vnextConfig). */
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

export const projectWriteFullConfigRequestSchema = {
  params: projectIdSchema,
  json: vnextWorkspaceFullConfigSchema,
}
