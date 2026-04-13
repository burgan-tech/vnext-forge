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
