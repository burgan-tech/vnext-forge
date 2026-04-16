import { z } from 'zod'
import type { RequestSchemas } from '@shared/lib/request.js'

export const validateRequestSchema = {
  json: z.unknown(),
} satisfies RequestSchemas

export const validateComponentRequestSchema = {
  json: z.object({
    content: z.unknown(),
    type: z.string().min(1, 'Component type is required'),
  }),
} satisfies RequestSchemas

export const schemaByTypeRequestSchema = {
  params: z.object({
    type: z.string().min(1),
  }),
} satisfies RequestSchemas
