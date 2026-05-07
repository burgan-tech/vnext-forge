import { z } from 'zod';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';

const schemaNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(z.string(), z.unknown()),
);

export const schemaMetadataFormSchema = z.object({
  key: z.string().trim().min(1, 'Key is required.'),
  version: z.string().trim().min(1, 'Version is required.'),
  domain: z.string().trim().min(1, 'Domain is required.'),
  flow: z.string().trim(),
  tags: z.array(z.string().trim().min(1, 'Tags cannot be empty.')),
});

export type SchemaMetadataFormValues = z.infer<typeof schemaMetadataFormSchema>;

export const schemaEditorDocumentSchema = z
  .object({
    key: z.string().trim().min(1),
    version: z.string().trim().min(1),
    domain: z.string().trim().min(1),
    flow: z.string().optional(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    attributes: z
      .object({
        schema: schemaNodeSchema,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export function toSchemaMetadataFormValues(
  json: Record<string, unknown>,
): SchemaMetadataFormValues {
  return {
    key: typeof json.key === 'string' ? json.key : '',
    version: typeof json.version === 'string' ? json.version : '',
    domain: typeof json.domain === 'string' ? json.domain : '',
    flow: typeof json.flow === 'string' ? json.flow : '',
    tags: Array.isArray(json.tags) ? json.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

export function getSchemaSource(
  json: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = schemaEditorDocumentSchema.safeParse(json);

  if (!parsed.success) {
    return {};
  }

  return parsed.data.attributes?.schema ?? {};
}

export function assertSchemaEditorDocument(
  value: unknown,
  source: string,
): Record<string, unknown> {
  const parsed = schemaEditorDocumentSchema.safeParse(value);

  if (!parsed.success) {
    throw new VnextForgeError(
      ERROR_CODES.INTERNAL_UNEXPECTED,
      'Schema document is invalid.',
      {
        source,
        layer: 'feature',
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    );
  }

  return parsed.data;
}
