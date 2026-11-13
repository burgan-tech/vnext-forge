export {
  type SchemaCapabilities,
  type DefinitionCapabilities,
  ALL_ENABLED,
  deriveSchemaCapabilities,
  hasFeature,
  schemaEnumValues,
} from './SchemaCapabilities.js';

export { useSchemaCapabilities, resetSchemaCapabilitiesCache } from './useSchemaCapabilities.js';

export { useSchemaCapabilitiesStore, storeKey } from './useSchemaCapabilitiesStore.js';
