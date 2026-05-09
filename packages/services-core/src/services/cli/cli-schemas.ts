import { z } from 'zod'

export const CLI_ALLOWED_COMMANDS = [
  'check',
  'update',
  'update --all',
  'update -f',
  'csx --all',
  'sync',
] as const

export type CliAllowedCommand = (typeof CLI_ALLOWED_COMMANDS)[number]

export const cliAllowedCommandSchema = z.enum(CLI_ALLOWED_COMMANDS)

export const cliCheckParams = z.object({}).strict()

export const cliCheckResult = z.object({
  available: z.boolean(),
  version: z.string().optional(),
})

export const cliCheckUpdateParams = z.object({}).strict()

export const cliCheckUpdateResult = z.object({
  installed: z.string().nullable(),
  latest: z.string().nullable(),
  updateAvailable: z.boolean(),
})

export const cliUpdateGlobalParams = z.object({}).strict()

export const cliUpdateGlobalResult = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
})

const DEFAULT_CLI_TIMEOUT_MS = 60_000
const MAX_CLI_TIMEOUT_MS = 300_000

export const cliExecuteParams = z
  .object({
    command: cliAllowedCommandSchema,
    projectId: z.string().optional(),
    projectPath: z.string().optional(),
    filePath: z.string().optional(),
    timeoutMs: z.number().int().min(1).max(MAX_CLI_TIMEOUT_MS).optional(),
  })
  .strict()
  .superRefine((params, ctx) => {
    const id = params.projectId?.trim() ?? ''
    const root = params.projectPath?.trim() ?? ''
    const hasId = id.length > 0
    const hasPath = root.length > 0
    if (hasId === hasPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of projectId or projectPath must be provided.',
        path: hasId ? ['projectPath'] : ['projectId'],
      })
    }
    if (params.command === 'update -f') {
      const fp = params.filePath?.trim() ?? ''
      if (!fp.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'filePath is required when command is "update -f".',
          path: ['filePath'],
        })
      }
    }
  })

export const cliExecuteResult = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
})

export const CLI_EXECUTE_DEFAULT_TIMEOUT_MS = DEFAULT_CLI_TIMEOUT_MS
export const CLI_EXECUTE_MAX_TIMEOUT_MS = MAX_CLI_TIMEOUT_MS
