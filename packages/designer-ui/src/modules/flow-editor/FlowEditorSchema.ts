import { z } from 'zod';

export const flowEditorDocumentSchema = z.object({}).catchall(z.unknown());

/**
 * Schema for B64-encoded scripts that produce sidecar `.csx` files.
 * `location` is required; `encoding` is absent or 'B64'.
 */
export const flowEditorScriptSchema = z.object({
  location: z.string().trim().min(1, 'Script location is required.'),
  code: z.string(),
  encoding: z.enum(['B64', 'NAT']).optional(),
});

export type FlowEditorScriptEntry = z.infer<typeof flowEditorScriptSchema>;
