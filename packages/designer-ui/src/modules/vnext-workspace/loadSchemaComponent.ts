import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import { unwrapApi } from '../../api/client.js';
import { discoverVnextComponentsByCategory } from './vnextComponentDiscovery.js';

export interface SchemaReferenceLike {
  key: string;
  domain?: string;
  version?: string;
  flow?: string;
}

/** A `{ key, domain?, version?, flow? }` reference (e.g. workflow `attributes.schema`), or `null`. */
export function readSchemaReference(value: unknown): SchemaReferenceLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as Record<string, unknown>;
  if (typeof ref.key !== 'string' || ref.key.trim() === '') return null;
  return {
    key: ref.key,
    ...(typeof ref.domain === 'string' ? { domain: ref.domain } : {}),
    ...(typeof ref.version === 'string' ? { version: ref.version } : {}),
    ...(typeof ref.flow === 'string' ? { flow: ref.flow } : {}),
  };
}

export interface SchemaComponentLoaderDeps {
  listSchemas: (projectId: string) => Promise<DiscoveredVnextComponent[]>;
  readText: (path: string) => Promise<string>;
}

export const defaultSchemaComponentLoaderDeps: SchemaComponentLoaderDeps = {
  listSchemas: (projectId) => discoverVnextComponentsByCategory(projectId, 'schemas'),
  readText: async (path) => {
    const file = await unwrapApi<{ content: string }>(
      { method: 'files/read', params: { path: path.replace(/\\/g, '/') } },
      'Failed to read file',
    );
    return file.content;
  },
};

/**
 * Local schema component for `ref`, found by key in the project's schema
 * folder (the referenced domain wins when several solutions share the key).
 * Returns `null` on any failure — callers treat a missing schema as "no data".
 * Discovery de-dupes by key per solution, so `version` is not used to select.
 */
export async function loadSchemaComponent(
  projectId: string,
  ref: SchemaReferenceLike,
  deps: SchemaComponentLoaderDeps = defaultSchemaComponentLoaderDeps,
): Promise<Record<string, unknown> | null> {
  try {
    const sameKey = (await deps.listSchemas(projectId)).filter((s) => s.key === ref.key);
    const match = sameKey.find((s) => ref.domain !== undefined && s.domain === ref.domain) ?? sameKey[0];
    if (!match) return null;
    const parsed: unknown = JSON.parse(await deps.readText(match.path));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
