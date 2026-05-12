/**
 * Capability model derived from a component's JSON Schema at a specific
 * `schemaVersion`. Used to detect which features a schema version supports
 * so the UI can hide unavailable features and validation can skip rules
 * for properties that don't exist in the active version.
 *
 * The tree mirrors the schema nesting:
 *  - `attributes.*` → top-level component attribute features
 *  - `definitions.*` → named sub-schema features (state, transition, etc.)
 */

export interface DefinitionCapabilities {
  properties: Record<string, boolean>;
  required: Set<string>;
  items?: DefinitionCapabilities;
}

export interface SchemaCapabilities {
  attributes: Record<string, boolean>;
  attributesRequired: Set<string>;
  definitions: Record<string, DefinitionCapabilities>;
}

const ALL_ATTRIBUTES = new Proxy<Record<string, boolean>>({}, { get: () => true });
const ALL_DEFINITION: DefinitionCapabilities = {
  properties: ALL_ATTRIBUTES,
  required: new Proxy(new Set<string>(), { get: (target, prop) => (prop === 'has' ? () => true : Reflect.get(target, prop)) }),
};
const ALL_DEFINITIONS = new Proxy<Record<string, DefinitionCapabilities>>({}, { get: () => ALL_DEFINITION });
const ALL_REQUIRED = new Proxy(new Set<string>(), { get: (target, prop) => (prop === 'has' ? () => true : Reflect.get(target, prop)) });

/**
 * Sentinel returned when the schema is null or fetch failed.
 * Every feature check returns `true` → show everything, let AJV catch
 * real errors on save.
 *
 * WARNING: Proxy-based — only use via `hasFeature()` or direct property
 * access (e.g. `caps.attributes['cancel']`). Enumeration (`Object.keys`,
 * `for..of`, spread, `.size`) will return empty results. Never iterate
 * `ALL_ENABLED`; use `hasFeature` or direct reads only.
 */
export const ALL_ENABLED: SchemaCapabilities = {
  attributes: ALL_ATTRIBUTES,
  attributesRequired: ALL_REQUIRED,
  definitions: ALL_DEFINITIONS,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function extractProperties(obj: Record<string, unknown>): Record<string, boolean> {
  const props = obj.properties;
  if (!isRecord(props)) return {};
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(props)) {
    result[key] = true;
  }
  return result;
}

function extractRequired(obj: Record<string, unknown>): Set<string> {
  const req = obj.required;
  if (!Array.isArray(req)) return new Set();
  return new Set(req.filter((r): r is string => typeof r === 'string'));
}

/**
 * Collect extra property keys from `allOf` / `if-then` blocks.
 * Task schemas use `allOf[].then.properties.config.properties` for
 * per-type config shapes; function schemas use `allOf[].then.required`.
 */
function collectAllOfProperties(obj: Record<string, unknown>, target: Record<string, boolean>): void {
  const allOf = obj.allOf;
  if (!Array.isArray(allOf)) return;
  for (const entry of allOf) {
    if (!isRecord(entry)) continue;
    const thenBlock = entry.then;
    if (isRecord(thenBlock)) {
      const thenProps = extractProperties(thenBlock);
      Object.assign(target, thenProps);
      const thenReq = thenBlock.required;
      if (Array.isArray(thenReq)) {
        for (const r of thenReq) {
          if (typeof r === 'string') target[r] = true;
        }
      }
    }
    const elseBlock = entry.else;
    if (isRecord(elseBlock)) {
      const elseProps = extractProperties(elseBlock);
      Object.assign(target, elseProps);
    }
    const directProps = extractProperties(entry);
    Object.assign(target, directProps);
  }
}

function collectAllOfRequired(obj: Record<string, unknown>, target: Set<string>): void {
  const allOf = obj.allOf;
  if (!Array.isArray(allOf)) return;
  for (const entry of allOf) {
    if (!isRecord(entry)) continue;
    const thenBlock = entry.then;
    if (isRecord(thenBlock)) {
      const req = thenBlock.required;
      if (Array.isArray(req)) {
        for (const r of req) {
          if (typeof r === 'string') target.add(r);
        }
      }
    }
  }
}

function deriveDefinition(def: Record<string, unknown>): DefinitionCapabilities {
  const properties = extractProperties(def);
  collectAllOfProperties(def, properties);
  const required = extractRequired(def);
  collectAllOfRequired(def, required);

  let items: DefinitionCapabilities | undefined;
  const itemsSchema = def.items;
  if (isRecord(itemsSchema)) {
    items = deriveDefinition(itemsSchema);
  }

  return { properties, required, items };
}

/**
 * Derive capabilities from a raw JSON Schema object returned by
 * `validate/getSchema`. Returns `ALL_ENABLED` when schema is null
 * (graceful degradation).
 */
export function deriveSchemaCapabilities(
  schema: Record<string, unknown> | null,
): SchemaCapabilities {
  if (!schema) return ALL_ENABLED;

  const rootProps = isRecord(schema.properties) ? schema.properties : {};
  const attrsSchema = isRecord(rootProps.attributes) ? rootProps.attributes : {};

  const attributes = extractProperties(attrsSchema);
  collectAllOfProperties(attrsSchema, attributes);

  const attributesRequired = extractRequired(attrsSchema);
  collectAllOfRequired(attrsSchema, attributesRequired);

  const definitions: Record<string, DefinitionCapabilities> = {};
  const defs = schema.definitions;
  if (isRecord(defs)) {
    for (const [name, defValue] of Object.entries(defs)) {
      if (isRecord(defValue)) {
        definitions[name] = deriveDefinition(defValue);
      }
    }
  }

  return { attributes, attributesRequired, definitions };
}

/**
 * Convenience helper for dot-notation capability checks.
 *
 * Paths:
 * - `"attributes.cancel"` → `caps.attributes['cancel']`
 * - `"definitions.state.errorBoundary"` → `caps.definitions['state']?.properties['errorBoundary']`
 * - `"definitions.transition.timer"` → `caps.definitions['transition']?.properties['timer']`
 *
 * Returns `true` when the path segment is present (or when capabilities
 * are `ALL_ENABLED`). Returns `true` on unknown paths to avoid hiding
 * features by mistake.
 */
export function hasFeature(caps: SchemaCapabilities, path: string): boolean {
  const segments = path.split('.');
  if (segments.length === 0) return true;

  if (segments[0] === 'attributes') {
    if (segments.length === 1) return true;
    return caps.attributes[segments[1]] === true;
  }

  if (segments[0] === 'definitions') {
    if (segments.length < 3) return true;
    const def = caps.definitions[segments[1]];
    if (!def) return true;
    return def.properties[segments[2]] === true;
  }

  return true;
}
