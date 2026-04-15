import { homedir } from 'node:os'
import { z } from 'zod'

export const fileReadRequestSchema = {
  query: z.object({
    path: z.string().min(1, 'File path is required'),
  }),
}

export const fileWriteRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'File path is required'),
    content: z.string(),
  }),
}

export const fileRemoveRequestSchema = fileReadRequestSchema

export const fileCreateDirectoryRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'Directory path is required'),
  }),
}

export const fileRenameRequestSchema = {
  json: z.object({
    oldPath: z.string().min(1, 'oldPath is required'),
    newPath: z.string().min(1, 'newPath is required'),
  }),
}

export const fileBrowseRequestSchema = {
  query: z.object({
    path: z.string().optional().default(homedir()),
  }),
}

export const fileSearchRequestSchema = {
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    project: z.string().min(1, 'Project path is required'),
    matchCase: z.coerce.boolean().optional().default(false),
    matchWholeWord: z.coerce.boolean().optional().default(false),
    useRegex: z.coerce.boolean().optional().default(false),
    include: z.string().optional(),
    exclude: z.string().optional(),
  }),
}
