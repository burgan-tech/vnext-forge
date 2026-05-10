/**
 * Resolve the JSON Schema for a given vNext component type
 * (`task`, `workflow`, `schema`, `function`, `extension`, `view`, ...).
 *
 * The schema is fetched from the host through `validate/getSchema`,
 * threaded with the project's pinned `vnext.config.json#schemaVersion`
 * so the form's `required` markers track the project's contract — not
 * whatever ships bundled with the desktop app.
 *
 * Module-level cache keyed by `<type>:<schemaVersion>` deduplicates
 * concurrent mounts (e.g. opening multiple TaskMetadataForms at once)
 * and survives across re-renders within the same project session.
 * Cached entries are reset when the project's `vnextConfig` changes,
 * because that signals a project switch / config reload.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../../store/useProjectStore';
import { callApi } from '../../api/client';

export interface ComponentTypeSchemaState {
  /** The raw JSON Schema (may be `null` if the host has no schema for this type). */
  schema: Record<string, unknown> | null;
  /** Top-level `required` array as a Set, for fast membership checks. */
  requiredFields: ReadonlySet<string>;
  /** True while the request is in flight (initial mount or schemaVersion change). */
  loading: boolean;
  /** Last error message, if any. The hook still returns a usable empty Set. */
  error: string | null;
}

interface CacheEntry {
  promise: Promise<Record<string, unknown> | null>;
  schema: Record<string, unknown> | null;
  resolved: boolean;
  error: string | null;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(type: string, schemaVersion: string | undefined): string {
  return schemaVersion ? `${type}:${schemaVersion}` : `${type}:__bundled__`;
}

async function fetchSchema(
  type: string,
  schemaVersion: string | undefined,
): Promise<Record<string, unknown> | null> {
  const params: { type: string; schemaVersion?: string } = { type };
  if (schemaVersion) params.schemaVersion = schemaVersion;
  const result = await callApi<Record<string, unknown> | null>({
    method: 'validate/getSchema',
    params,
  });
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

function getOrCreateEntry(
  type: string,
  schemaVersion: string | undefined,
): CacheEntry {
  const key = cacheKey(type, schemaVersion);
  let entry = cache.get(key);
  if (entry) return entry;
  entry = {
    promise: fetchSchema(type, schemaVersion).then(
      (schema) => {
        const e = cache.get(key);
        if (e) {
          e.schema = schema;
          e.resolved = true;
        }
        return schema;
      },
      (err) => {
        const e = cache.get(key);
        if (e) {
          e.error = err instanceof Error ? err.message : String(err);
          e.resolved = true;
        }
        return null;
      },
    ),
    schema: null,
    resolved: false,
    error: null,
  };
  cache.set(key, entry);
  return entry;
}

/**
 * Hook returning the schema + a precomputed Set of top-level required
 * fields. Forms can mark their inputs `required` straight from the Set:
 *
 * ```tsx
 * const { requiredFields } = useComponentTypeSchema('task');
 * <Field label="Key" required={requiredFields.has('key')}>
 *   ...
 * </Field>
 * ```
 *
 * Loading-state UX is left to the caller: the Set starts empty during
 * the fetch, so forms render without asterisks until the schema lands —
 * which is fine for our use case (the user is unlikely to spot the
 * 50-200ms gap, and the input still works).
 */
export function useComponentTypeSchema(type: string): ComponentTypeSchemaState {
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);
  const [, force] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const entry = useMemo(
    () => getOrCreateEntry(type, schemaVersion),
    [type, schemaVersion],
  );

  useEffect(() => {
    if (entry.resolved) return;
    let cancelled = false;
    void entry.promise.then(() => {
      if (cancelled) return;
      if (!isMountedRef.current) return;
      // Trigger re-render now that the schema is in.
      force((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  return useMemo<ComponentTypeSchemaState>(() => {
    const required = new Set(
      Array.isArray((entry.schema as { required?: unknown })?.required)
        ? ((entry.schema as { required?: string[] }).required as string[])
        : [],
    );
    return {
      schema: entry.schema,
      requiredFields: required,
      loading: !entry.resolved,
      error: entry.error,
    };
  }, [entry, entry.schema, entry.resolved, entry.error]);
}

/**
 * Test-only escape hatch — useful when a host shell switches projects
 * and we want to drop schemas resolved against the previous version.
 * Production code should never need to call this; the cache is keyed by
 * `(type, schemaVersion)` so a new version naturally produces a new
 * entry.
 */
export function resetComponentTypeSchemaCache(): void {
  cache.clear();
}
