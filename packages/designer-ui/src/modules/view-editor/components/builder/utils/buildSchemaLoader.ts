/**
 * R16.1: lazy on-disk resolver for view dataSchema URNs.
 *
 * The Builder needs the actual JSON-schema object (not just the URN)
 * so the Inspector's bind-autocomplete + lookups picker (R14.1) and
 * the SDK preview (`<PseudoView resolveSchema={...}>`) can reason
 * about properties, types, lookups, and ForEach/Component shapes.
 *
 * Quick Runner does the equivalent over HTTP via
 * `createDataSchemaResolver` (calls the running engine). The Builder
 * is a designer surface — there is no runtime — so we read the
 * matching workspace Schemas component file directly through
 * `WorkspaceApi.readFile` and unwrap `attributes.schema`.
 *
 * Lookup order for an incoming URN/URL/key:
 *   1. Direct hit against the pre-built `urn ↔ DiscoveredVnextComponent`
 *      index (built once from the discovery result).
 *   2. Fall back to parsing the input as a DataSchemaRef and matching
 *      by `key`. This handles bare keys and URL forms where the picker
 *      hasn't been used.
 *
 * Results are cached in-memory per loader instance. Recreate the
 * loader (or evict explicitly when wired up to workspace-fs-events)
 * when the underlying schema file changes on disk.
 */

import type { DataSchema } from '@burgantech/pseudo-ui';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import { parseDataSchemaRef } from '../../../../quick-run/pseudo-ui/parseDataSchemaRef';
import { readFile } from '../../../../project-workspace/WorkspaceApi';
import { buildSchemaUrn } from './buildSchemaUrn';

export type SchemaLoader = (urn: string) => Promise<DataSchema | null>;

export interface BuildSchemaLoaderOptions {
  /** Discovered Schemas components from `discoverVnextComponentsByCategory('schemas')`. */
  schemas: readonly DiscoveredVnextComponent[];
  /** Active project root path — used to derive each schema's URN domain. */
  projectPath: string | undefined;
}

export function buildSchemaLoader({ schemas, projectPath }: BuildSchemaLoaderOptions): SchemaLoader {
  const cache = new Map<string, DataSchema>();
  const urnIndex = new Map<string, DiscoveredVnextComponent>();
  for (const component of schemas) {
    urnIndex.set(buildSchemaUrn(component, projectPath), component);
  }

  return async (input: string): Promise<DataSchema | null> => {
    if (!input || typeof input !== 'string') return null;
    const cached = cache.get(input);
    if (cached) return cached;

    let component = urnIndex.get(input);
    if (!component) {
      // Fallback: parse and match by key. parseDataSchemaRef supports
      // URN, schemas.vnext.com URL, and bare-key inputs alike.
      const parsed = parseDataSchemaRef(input);
      if (!parsed) return null;
      component = schemas.find((s) => s.key === parsed.key);
      if (!component) return null;
    }

    try {
      const { content } = await readFile(component.path);
      const parsed = JSON.parse(content) as { attributes?: { schema?: unknown } };
      const schema = parsed.attributes?.schema;
      if (!schema || typeof schema !== 'object') return null;
      const dataSchema = schema as DataSchema;
      cache.set(input, dataSchema);
      return dataSchema;
    } catch {
      // File missing, JSON parse failure, or wrong shape — fall back to null
      // so the inspector + canvas render in free-text mode.
      return null;
    }
  };
}
