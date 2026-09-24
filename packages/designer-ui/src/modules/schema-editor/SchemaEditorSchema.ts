import { z } from 'zod';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';

const schemaNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(z.string(), z.unknown()),
);

export const schemaMetadataFormSchema = z.object({
  key: z.string().trim().min(1, 'Key is required.'),
  version: z.string().trim().min(1, 'Version is required.'),
  domain: z.string().trim().min(1, 'Domain is required.'),
  flow: z.string().trim().min(1, 'Flow is required.'),
  flowVersion: z.string().trim().min(1, 'Flow version is required.'),
  tags: z.array(z.string().trim().min(1, 'Tags cannot be empty.')).min(1, 'At least one tag is required.'),
});

export type SchemaMetadataFormValues = z.infer<typeof schemaMetadataFormSchema>;

/**
 * Permissive document schema used on **load** so that legacy files
 * (missing `flow`, `flowVersion`, or `tags`) can still open in the editor
 * for repair. Authoritative enforcement happens at **save** time via
 * `validateComponentBeforeWrite` (AJV / vnext-schema).
 */
export const schemaEditorDocumentSchema = z
  .object({
    key: z.string().trim().min(1),
    version: z.string().trim().min(1),
    domain: z.string().trim().min(1),
    flow: z.string().optional(),
    flowVersion: z.string().optional(),
    tags: z.array(z.string()).optional(),
    attributes: z
      .object({
        /**
         * Free-text schema purpose (vnext-schema master). Only `master` permits
         * `x-indexed`. Kept permissive here so a legacy file with a wrong type
         * still opens for repair; the UI reads it via `readSchemaAttributesType`.
         */
        type: z.unknown().optional(),
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
    flowVersion: typeof json.flowVersion === 'string' ? json.flowVersion : '',
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

/** The only `attributes.type` value that permits `x-indexed` (runtime + vnext-schema master). */
export const MASTER_SCHEMA_TYPE = 'master';

/** Suggestions for the free-text `attributes.type` combobox (D1). */
export const SCHEMA_TYPE_SUGGESTIONS = [MASTER_SCHEMA_TYPE, 'schema', 'view', 'headers'] as const;

/** `attributes.type` when it is a string, otherwise `undefined`. */
export function readSchemaAttributesType(
  json: Record<string, unknown> | null | undefined,
): string | undefined {
  const attributes = json?.attributes;
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return undefined;
  }
  const type = (attributes as Record<string, unknown>).type;
  return typeof type === 'string' ? type : undefined;
}

/** Write `attributes.type` on an Immer draft, creating `attributes` when missing. */
export function setSchemaAttributesType(draft: Record<string, unknown>, value: string): void {
  const current = draft.attributes;
  const attributes =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  attributes.type = value;
  draft.attributes = attributes;
}
