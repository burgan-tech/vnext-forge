import { z } from 'zod';

export const flowEditorDocumentSchema = z.object({}).catchall(z.unknown());

export const flowEditorScriptSchema = z.object({
  location: z.string().trim().min(1, 'Script location is required.'),
  code: z.string(),
});

export type FlowEditorScriptEntry = z.infer<typeof flowEditorScriptSchema>;
