import path from 'node:path';

import { faker } from '@faker-js/faker';
import {
  generate as jsfGenerate,
  type GenerateOptions,
  type JsonSchema,
} from 'json-schema-faker';

import type { LoggerAdapter } from '../../adapters/logger.js';
import type { FileSystemAdapter } from '../../adapters/file-system.js';
import type { ProjectService } from '../project/project.service.js';
import { buildComponentFolderRelPaths } from '../project/vnext-component-folder-paths.js';

import type {
  TestDataGenerateForSchemaComponentParams,
  TestDataGenerateForSchemaComponentResult,
  TestDataGenerateForSchemaReferenceParams,
  TestDataGenerateForSchemaReferenceResult,
  TestDataGenerateParams,
  TestDataGenerateResult,
} from './test-data-schemas.js';

export interface TestDataServiceDeps {
  fs: FileSystemAdapter;
  logger: LoggerAdapter;
  projectService: ProjectService;
}

export interface TestDataService {
  generate(params: TestDataGenerateParams): Promise<TestDataGenerateResult>;
  generateForSchemaComponent(
    params: TestDataGenerateForSchemaComponentParams,
  ): Promise<TestDataGenerateForSchemaComponentResult>;
  generateForSchemaReference(
    params: TestDataGenerateForSchemaReferenceParams,
  ): Promise<TestDataGenerateForSchemaReferenceResult>;
}

/**
 * Service backing `test-data/*` registry methods. Wraps `json-schema-faker`
 * with project-aware schema resolution so the UI can either
 *
 *  (a) paste an arbitrary JSON Schema and get a random instance, or
 *  (b) pick a vNext Schema component (`Schemas/<group>/<name>.json`) and
 *      get an instance conforming to its embedded `attributes.schema`.
 *
 * Both paths return a JSON-safe value plus a `warnings[]` array — the
 * generator captures non-fatal issues (e.g. unhandled `$ref` chains) as
 * warnings so the UI can surface them inline without aborting.
 */
export function createTestDataService(deps: TestDataServiceDeps): TestDataService {
  const { fs, logger, projectService } = deps;

  function buildOptions(input: TestDataGenerateParams['options']): GenerateOptions {
    const opts: GenerateOptions = {
      // Default to a complete instance (every optional populated) so users
      // see the full shape; they can prune by hand if they want a sparse
      // payload. Matches the `alwaysFakeOptionals` knob users already know
      // from the older JSF API.
      alwaysFakeOptionals: input?.alwaysFakeOptionals ?? true,
      useDefaultValue: true,
      // Hook @faker-js/faker as the value source — without this JSF falls
      // back to its tiny built-in randomizer that generates random
      // alphanumerics for every string regardless of the field name.
      extensions: { faker },
    };
    if (input?.seed != null) {
      const seed = typeof input.seed === 'string' ? hashSeed(input.seed) : input.seed;
      opts.seed = seed;
      // @faker-js/faker accepts the same seed; together they make the
      // whole generation deterministic for golden-test fixtures.
      faker.seed(seed);
    } else {
      faker.seed();
    }
    return opts;
  }

  async function generate(
    params: TestDataGenerateParams,
  ): Promise<TestDataGenerateResult> {
    const warnings: string[] = [];
    const opts = buildOptions(params.options);
    try {
      const instance = await jsfGenerate(params.schema as JsonSchema, opts);
      return { instance, warnings };
    } catch (err) {
      logger.warn(
        { err, code: 'TEST_DATA_GENERATE_FAILED' },
        'json-schema-faker generation failed',
      );
      throw new Error(
        err instanceof Error
          ? `Test data generation failed: ${err.message}`
          : 'Test data generation failed',
      );
    }
  }

  async function generateForSchemaComponent(
    params: TestDataGenerateForSchemaComponentParams,
  ): Promise<TestDataGenerateForSchemaComponentResult> {
    const project = await projectService.getProject(params.projectId);
    const projectPath = project.path;
    const config = await projectService.getConfig(params.projectId);
    const folderRelPaths = buildComponentFolderRelPaths(config?.paths);
    const schemasRel = folderRelPaths?.schemas;
    if (!schemasRel) {
      throw new Error(
        `Project "${params.projectId}" has no Schemas folder configured in vnext.config.json.`,
      );
    }
    const schemaSourcePath = path.join(
      projectPath,
      schemasRel,
      params.group,
      `${params.name}.json`,
    );

    let raw: string;
    try {
      raw = await fs.readFile(schemaSourcePath);
    } catch (err) {
      throw new Error(
        `Schema component not found at ${schemaSourcePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Schema component is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Schema component file did not contain a JSON object.');
    }
    const attributes = (parsed as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== 'object') {
      throw new Error('Schema component is missing an `attributes` field.');
    }
    const schema = (attributes as { schema?: unknown }).schema;
    if (!schema || typeof schema !== 'object') {
      throw new Error(
        'Schema component is missing `attributes.schema` (the embedded JSON Schema).',
      );
    }

    const generated = await generate({
      schema: schema as Record<string, unknown>,
      options: params.options,
    });

    return {
      instance: generated.instance,
      schema: schema as Record<string, unknown>,
      schemaSourcePath,
      warnings: generated.warnings,
    };
  }

  /**
   * Resolve a `{key, flow?, domain?, version}` schema reference to a Schema
   * component file under the project, then run `generate()` against its
   * embedded JSON Schema. This is what QuickRun's "Auto-fill payload" calls
   * with the active workflow's `attributes.startTransition.schema`.
   *
   * Strategy:
   *  1. Resolve project root + Schemas folder path.
   *  2. Walk `Schemas/<group>/<name>.json` and `Schemas/<name>.json` (top-level).
   *  3. Parse each candidate; match where inner `key` and `version` align
   *     (and `flow`/`domain` when supplied).
   *  4. Pick the first match (single-version expectation), extract
   *     `attributes.schema`, generate.
   *
   * Throws when no match is found — caller's UI shows a clear "Schema
   * reference not found" error so the user knows to check the workflow's
   * schema field.
   */
  async function generateForSchemaReference(
    params: TestDataGenerateForSchemaReferenceParams,
  ): Promise<TestDataGenerateForSchemaReferenceResult> {
    const project = await projectService.getProject(params.projectId);
    const projectPath = project.path;
    const config = await projectService.getConfig(params.projectId);
    const folderRelPaths = buildComponentFolderRelPaths(config?.paths);
    const schemasRel = folderRelPaths?.schemas;
    if (!schemasRel) {
      throw new Error(
        `Project "${params.projectId}" has no Schemas folder configured in vnext.config.json.`,
      );
    }

    const schemasAbs = path.join(projectPath, schemasRel);
    if (!(await fs.exists(schemasAbs))) {
      throw new Error(`Schemas folder not found at ${schemasAbs}.`);
    }

    // Collect candidate files. Two layouts supported:
    //  - `Schemas/<group>/<name>.json`  (most common)
    //  - `Schemas/<name>.json`          (top-level, e.g. shared schemas)
    const candidates: string[] = [];
    for (const entry of await fs.readDir(schemasAbs)) {
      const entryAbs = path.join(schemasAbs, entry.name);
      if (entry.isFile && entry.name.toLowerCase().endsWith('.json')) {
        candidates.push(entryAbs);
        continue;
      }
      if (entry.isDirectory) {
        for (const child of await fs.readDir(entryAbs)) {
          if (child.isFile && child.name.toLowerCase().endsWith('.json')) {
            candidates.push(path.join(entryAbs, child.name));
          }
        }
      }
    }

    let matchedPath: string | null = null;
    let matchedSchema: Record<string, unknown> | null = null;
    for (const candidatePath of candidates) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await fs.readFile(candidatePath));
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== 'object') continue;
      const obj = parsed as Record<string, unknown>;
      if (obj.key !== params.schemaRef.key) continue;
      if (obj.version !== params.schemaRef.version) continue;
      if (params.schemaRef.flow && obj.flow !== params.schemaRef.flow) continue;
      if (params.schemaRef.domain && obj.domain !== params.schemaRef.domain) continue;
      const attributes = obj.attributes;
      if (!attributes || typeof attributes !== 'object') continue;
      const inner = (attributes as { schema?: unknown }).schema;
      if (!inner || typeof inner !== 'object') continue;
      matchedPath = candidatePath;
      matchedSchema = inner as Record<string, unknown>;
      break;
    }

    if (!matchedSchema || !matchedPath) {
      throw new Error(
        `Schema reference "${params.schemaRef.key} ${params.schemaRef.version}" not found in this project.`,
      );
    }

    const generated = await generate({
      schema: matchedSchema,
      options: params.options,
    });

    return {
      instance: generated.instance,
      schema: matchedSchema,
      schemaSourcePath: matchedPath,
      warnings: generated.warnings,
    };
  }

  return {
    generate,
    generateForSchemaComponent,
    generateForSchemaReference,
  };
}

/**
 * Stable string→int hash for deterministic faker seeding when callers
 * supply a human-readable label (e.g. `"john-smoke-1"`). 32-bit FNV-1a;
 * collision-resistant enough for "same seed → same output" within a
 * developer's session.
 */
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
