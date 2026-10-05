import { z } from 'zod';

const runtimeHealthResponseSchema = z.object({
  status: z.enum(['ok', 'down']),
  version: z.string().optional(),
  domain: z.string().optional(),
  traceId: z.string().optional(),
});

export type RuntimeHealthResponse = z.infer<typeof runtimeHealthResponseSchema>;

export function parseRuntimeHealthResponse(value: unknown): RuntimeHealthResponse {
  return runtimeHealthResponseSchema.parse(value);
}
