import { z } from 'zod';

/**
 * Param / result schemas for the `test-data/*` registry methods.
 *
 * The MVP exposes two entry points:
 *
 *  - `test-data/generate({ schema, options? })` — generic. Caller passes any
 *    JSON Schema (Draft 2020-12 friendly), gets a faker-driven random
 *    instance back. Used by the standalone "paste a schema" mode in the
 *    UI overlay and as the building block for everything else.
 *
 *  - `test-data/generateForSchemaComponent({ projectId, group, name })` —
 *    project-aware. Resolves a vNext Schema component
 *    (`Schemas/<group>/<name>.json`), reads `attributes.schema` (the
 *    embedded JSON Schema), and feeds it through the same generator.
 *    Returns the rendered instance plus echoes which schema was used.
 */

// generate ─────────────────────────────────────────────────────────────────

const generateOptions = z
  .object({
    /** PRNG seed; same seed → same output. Useful for golden test fixtures. */
    seed: z.union([z.number(), z.string()]).optional(),
    /** Target the json-schema-faker draft. Default 2020-12. */
    draft: z
      .enum(['draft-04', 'draft-06', 'draft-07', '2019-09', '2020-12'])
      .optional(),
    /** When false, optional properties are omitted with 50/50 probability. */
    alwaysFakeOptionals: z.boolean().optional(),
  })
  .optional();

export const testDataGenerateParamsSchema = z.object({
  /** Any JSON Schema object. We treat this as opaque payload. */
  schema: z.record(z.string(), z.unknown()),
  options: generateOptions,
});
export type TestDataGenerateParams = z.infer<typeof testDataGenerateParamsSchema>;

export const testDataGenerateResultSchema = z.object({
  /** The generated instance. Always a plain object/array/scalar — JSON-safe. */
  instance: z.unknown(),
  /** Per-call diagnostic — populated when faker raised non-fatal warnings. */
  warnings: z.array(z.string()).default([]),
});
export type TestDataGenerateResult = z.infer<typeof testDataGenerateResultSchema>;

// generateForSchemaComponent ────────────────────────────────────────────────

export const testDataGenerateForSchemaComponentParamsSchema = z.object({
  projectId: z.string().min(1),
  /** Domain folder under `Schemas/`, e.g. `account-opening`. */
  group: z.string().min(1),
  /** File basename without `.json`, e.g. `customer-application-1.0.0`. */
  name: z.string().min(1),
  options: generateOptions,
});
export type TestDataGenerateForSchemaComponentParams = z.infer<
  typeof testDataGenerateForSchemaComponentParamsSchema
>;

export const testDataGenerateForSchemaComponentResultSchema = z.object({
  instance: z.unknown(),
  /** The JSON Schema actually used (mirrors `attributes.schema`). */
  schema: z.record(z.string(), z.unknown()),
  /** Resolved file path on disk (handy for the UI footer). */
  schemaSourcePath: z.string(),
  warnings: z.array(z.string()).default([]),
});
export type TestDataGenerateForSchemaComponentResult = z.infer<
  typeof testDataGenerateForSchemaComponentResultSchema
>;

// generateForSchemaReference ───────────────────────────────────────────────
// Resolves a workflow's `startTransition.schema = {key, flow, domain, version}`
// reference to a Schema component file under `Schemas/`, then generates a
// faker-driven instance of its embedded JSON Schema. This is the entry point
// the QuickRun "Auto-fill payload" button uses — workflow knows its own
// schema reference but not the file path; the service does the discovery.

export const testDataGenerateForSchemaReferenceParamsSchema = z.object({
  projectId: z.string().min(1),
  schemaRef: z.object({
    /** Schema component's `key` field (e.g. "email-request"). */
    key: z.string().min(1),
    /** Schema component's `flow` field (typically "sys-schemas"). */
    flow: z.string().min(1).optional(),
    /** Schema component's `domain` (matches workflow's domain). */
    domain: z.string().min(1).optional(),
    /** Specific version to resolve (e.g. "1.0.0"). */
    version: z.string().min(1),
  }),
  options: generateOptions,
});
export type TestDataGenerateForSchemaReferenceParams = z.infer<
  typeof testDataGenerateForSchemaReferenceParamsSchema
>;

export const testDataGenerateForSchemaReferenceResultSchema = z.object({
  instance: z.unknown(),
  schema: z.record(z.string(), z.unknown()),
  schemaSourcePath: z.string(),
  warnings: z.array(z.string()).default([]),
});
export type TestDataGenerateForSchemaReferenceResult = z.infer<
  typeof testDataGenerateForSchemaReferenceResultSchema
>;
