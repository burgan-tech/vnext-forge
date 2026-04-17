import { z } from 'zod';

const runtimeHealthResponseSchema = z.object({
  status: z.literal('ok'),
  traceId: z.string().optional(),
});

export type RuntimeHealthResponse = z.infer<typeof runtimeHealthResponseSchema>;

export function parseRuntimeHealthResponse(value: unknown): RuntimeHealthResponse {
  return runtimeHealthResponseSchema.parse(value);
}
