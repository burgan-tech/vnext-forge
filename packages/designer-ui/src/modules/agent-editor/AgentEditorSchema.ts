import { z } from 'zod';

/**
 * Loose validation for the raw `sys-agents` JSON. We accept anything
 * that parses as an object so the editor can repair partially-broken
 * files; downstream `validateComponentBeforeWrite` enforces the full
 * `@burgan-tech/vnext-schema` agent shape on save.
 */
export const agentEditorDocumentSchema = z
  .object({
    key: z.string().optional(),
    version: z.string().optional(),
    domain: z.string().optional(),
    flow: z.string().optional(),
    flowVersion: z.string().optional(),
    tags: z.array(z.string()).optional(),
    attributes: z.object({}).passthrough().optional(),
  })
  .passthrough();

/** Patterns copied from `@burgan-tech/vnext-schema` agent-definition. */
const KEY_PATTERN = /^[a-z0-9-]+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z]+\.\d+)?$/;

/**
 * Form-level validation for the Agent editor's top metadata Card.
 * Mirrors the equivalent schemas in `FunctionEditorSchema.ts` /
 * `ExtensionEditorSchema.ts`. `flow` is constrained to the literal
 * `sys-agents` since the Agent editor cannot author components of
 * any other flow.
 */
export const agentMetadataFormSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Key is required.')
    .regex(KEY_PATTERN, 'Key must be lowercase letters, digits and dashes only.'),
  version: z
    .string()
    .trim()
    .min(1, 'Version is required.')
    .regex(VERSION_PATTERN, 'Version must be in Major.Minor.Patch format.'),
  domain: z
    .string()
    .trim()
    .min(1, 'Domain is required.')
    .regex(KEY_PATTERN, 'Domain must be lowercase letters, digits and dashes only.'),
  flow: z.literal('sys-agents'),
  flowVersion: z
    .string()
    .trim()
    .min(1, 'Flow version is required.')
    .regex(VERSION_PATTERN, 'Flow version must be in Major.Minor.Patch format.'),
  tags: z.array(z.string().trim().min(1, 'Tags cannot be empty.')),
  _comment: z.string().optional(),
});

export type AgentMetadataFormValues = z.infer<typeof agentMetadataFormSchema>;

/**
 * Defensive converter from the raw on-disk JSON to the form shape.
 * Missing / non-string fields become empty strings so the form always
 * has a controlled value; `flow` defaults to the only legal literal.
 */
export function toAgentMetadataFormValues(
  json: Record<string, unknown>,
): AgentMetadataFormValues {
  return {
    key: typeof json.key === 'string' ? json.key : '',
    version: typeof json.version === 'string' ? json.version : '',
    domain: typeof json.domain === 'string' ? json.domain : '',
    flow: 'sys-agents',
    flowVersion: typeof json.flowVersion === 'string' ? json.flowVersion : '',
    tags: Array.isArray(json.tags)
      ? json.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    _comment: typeof json._comment === 'string' ? json._comment : '',
  };
}
