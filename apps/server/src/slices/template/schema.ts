import { z } from 'zod'
import type { RequestSchemas } from '@shared/lib/request.js'

export const templateSeedRequestSchema = {
  json: z.object({
    targetDir: z.string().min(1, 'Target directory is required'),
    domain: z.string().min(1, 'Domain name is required'),
    customConfig: z.unknown().optional(),
  }),
} satisfies RequestSchemas
