/**
 * Public types for the test-data generator overlay. Local mirror of the
 * services-core schemas — designer-ui never imports services-core (browser
 * bundle hygiene); the runtime payloads are validated server-side.
 */

export interface TestDataGenerateOptions {
  /** PRNG seed; same seed → same output. */
  seed?: number | string;
  /** Whether to fill optional properties. Default true (full instance). */
  alwaysFakeOptionals?: boolean;
}

export interface TestDataGenerateResult {
  instance: unknown;
  warnings: string[];
}

export interface TestDataGenerateForComponentResult {
  instance: unknown;
  schema: Record<string, unknown>;
  schemaSourcePath: string;
  warnings: string[];
}

/** Stripped-down view of a Schema component for the picker list. */
export interface SchemaComponentEntry {
  group: string;
  name: string;
  /** Pretty-printed `<group>/<name>` for the picker label. */
  label: string;
  /** Project-relative POSIX path. */
  filePath: string;
}
