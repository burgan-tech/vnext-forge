import { z } from 'zod'

const projectIdSchema = z.object({
  id: z.string().min(1, 'Project id is required'),
})

export const projectCreateRequestSchema = {
  json: z.object({
    domain: z.string().min(1, 'Project domain is required'),
    description: z.string().optional(),
    targetPath: z.string().optional(),
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
