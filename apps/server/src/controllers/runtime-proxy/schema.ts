import { z } from 'zod'

export const runtimeProxyRequestSchema = {
  headers: z.object({
    'x-runtime-url': z.string().url().optional(),
  }),
}
