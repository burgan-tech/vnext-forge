import { useMemo } from 'react';

import { useComponentTypeSchema } from '../component-metadata/useComponentTypeSchema';
import {
  ALL_ENABLED,
  deriveSchemaCapabilities,
  type SchemaCapabilities,
} from './SchemaCapabilities';
import { storeKey, useSchemaCapabilitiesStore } from './useSchemaCapabilitiesStore';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * Returns `SchemaCapabilities` for the given component type, derived from
 * the raw JSON Schema that `useComponentTypeSchema` already fetches and
 * caches. No duplicate RPC call is made.
 *
 * Falls back to `ALL_ENABLED` (show everything, let AJV catch errors on
 * save) while loading or when the schema is unavailable.
 */
export function useSchemaCapabilities(componentType: string): SchemaCapabilities {
  const { schema, loading } = useComponentTypeSchema(componentType);
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);
  const key = storeKey(componentType, schemaVersion);

  return useMemo(() => {
    if (loading || !schema) return ALL_ENABLED;

    const existing = useSchemaCapabilitiesStore.getState().entries[key];
    if (existing) return existing;

    const caps = deriveSchemaCapabilities(schema);
    useSchemaCapabilitiesStore.getState().set(key, caps);
    return caps;
  }, [schema, loading, key]);
}

/**
 * Test-only escape hatch — clears the capabilities store.
 * Production code should never need this.
 */
export function resetSchemaCapabilitiesCache(): void {
  useSchemaCapabilitiesStore.getState().clear();
}
