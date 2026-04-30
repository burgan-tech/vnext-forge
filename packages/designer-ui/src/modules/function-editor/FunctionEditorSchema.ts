import { z } from 'zod';

export const FUNCTION_SCOPE_VALUES = ['I', 'F', 'D'] as const;

export const functionScopeSchema = z.enum(FUNCTION_SCOPE_VALUES);

export const functionMetadataFormSchema = z.object({
  key: z.string().trim().min(1, 'Key is required.'),
  version: z.string().trim().min(1, 'Version is required.'),
  domain: z.string().trim().min(1, 'Domain is required.'),
  flow: z.string().trim(),
  scope: functionScopeSchema,
  tags: z.array(z.string().trim().min(1, 'Tags cannot be empty.')),
});

export type FunctionMetadataFormValues = z.infer<typeof functionMetadataFormSchema>;

export const functionEditorDocumentSchema = z
  .object({
    key: z.string().optional(),
    version: z.string().optional(),
    domain: z.string().optional(),
    flow: z.string().optional(),
    scope: functionScopeSchema.optional(),
    tags: z.array(z.string()).optional(),
    attributes: z.object({}).passthrough().optional(),
  })
  .passthrough();

export function toFunctionMetadataFormValues(
  json: Record<string, unknown>,
): FunctionMetadataFormValues {
  return {
    key: typeof json.key === 'string' ? json.key : '',
    version: typeof json.version === 'string' ? json.version : '',
    domain: typeof json.domain === 'string' ? json.domain : '',
    flow: typeof json.flow === 'string' ? json.flow : '',
    scope: typeof json.scope === 'string' && FUNCTION_SCOPE_VALUES.includes(json.scope as never)
      ? (json.scope as FunctionMetadataFormValues['scope'])
      : 'I',
    tags: Array.isArray(json.tags) ? json.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}
