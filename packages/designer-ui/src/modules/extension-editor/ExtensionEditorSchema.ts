import { z } from 'zod';

export const EXTENSION_TYPE_VALUES = [1, 2, 3, 4] as const;
export const EXTENSION_SCOPE_VALUES = [1, 2, 3] as const;

export const extensionTypeSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const extensionScopeSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const extensionMetadataFormSchema = z.object({
  key: z.string().trim().min(1, 'Key is required.'),
  version: z.string().trim().min(1, 'Version is required.'),
  domain: z.string().trim().min(1, 'Domain is required.'),
  flow: z.string().trim(),
  type: extensionTypeSchema,
  scope: extensionScopeSchema,
  definedFlows: z.array(z.string().trim().min(1)),
  tags: z.array(z.string().trim().min(1, 'Tags cannot be empty.')),
});

export type ExtensionMetadataFormValues = z.infer<typeof extensionMetadataFormSchema>;

export const extensionEditorDocumentSchema = z
  .object({
    key: z.string().optional(),
    version: z.string().optional(),
    domain: z.string().optional(),
    flow: z.string().optional(),
    type: extensionTypeSchema.optional(),
    scope: extensionScopeSchema.optional(),
    definedFlows: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    attributes: z.object({}).passthrough().optional(),
  })
  .passthrough();

export function toExtensionMetadataFormValues(
  json: Record<string, unknown>,
): ExtensionMetadataFormValues {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;

  const rawType = json.type ?? attrs.type;
  const type = (EXTENSION_TYPE_VALUES as readonly number[]).includes(rawType as number)
    ? (rawType as ExtensionMetadataFormValues['type'])
    : 1;

  const rawScope = json.scope ?? attrs.scope;
  const scope = (EXTENSION_SCOPE_VALUES as readonly number[]).includes(rawScope as number)
    ? (rawScope as ExtensionMetadataFormValues['scope'])
    : 1;

  const rawDefinedFlows = json.definedFlows ?? attrs.definedFlows;
  const rawTags = json.tags ?? attrs.tags;

  return {
    key: typeof json.key === 'string' ? json.key : '',
    version: typeof json.version === 'string' ? json.version : '',
    domain: typeof json.domain === 'string' ? json.domain : '',
    flow: typeof json.flow === 'string' ? json.flow : '',
    type,
    scope,
    definedFlows: Array.isArray(rawDefinedFlows)
      ? rawDefinedFlows.filter((f): f is string => typeof f === 'string')
      : [],
    tags: Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === 'string')
      : [],
  };
}
