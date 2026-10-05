import { hasFeature } from '../schema-capabilities/SchemaCapabilities';
import { useSchemaCapabilities } from '../schema-capabilities/useSchemaCapabilities';
import { useProjectStore } from '../../store/useProjectStore';

export interface SchemaFeatureState {
  /** The project's pinned schema knows the feature (true while it is still loading). */
  supported: boolean;
  /** `vnext.config.json#schemaVersion`, for the explanation when unsupported. */
  schemaVersion: string | undefined;
}

/**
 * Whether the project's pinned vnext-schema has a construct, e.g.
 * `definitions.roleGrant.allOf`. Editors keep such controls visible but
 * disabled when it does not, so the feature stays discoverable and the
 * reason is spelled out (see `SchemaFeatureHint`).
 */
export function useSchemaFeature(componentType: string, path: string): SchemaFeatureState {
  const caps = useSchemaCapabilities(componentType);
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);
  return { supported: hasFeature(caps, path), schemaVersion };
}
