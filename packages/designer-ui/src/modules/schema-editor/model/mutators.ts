/**
 * High-level Immer recipes for editing the schema sub-tree inside a Schema
 * Component document. Every mutator returns a `(draft) => void` callback
 * suitable for `useSchemaEditorStore.updateComponent`.
 */

import { type ArrayCompositionKeyword } from './compositionKeywords';
import { parsePointer, type JsonPointer } from './jsonPointer';
import { isPrimitiveType, type PrimitiveType, type SchemaNode } from './schemaNode';

export type SchemaUpdater = (draft: Record<string, unknown>) => void;

function getSchemaDraftRoot(draft: Record<string, unknown>): SchemaNode | null {
  let attributes = draft.attributes;

  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    attributes = {};
    draft.attributes = attributes;
  }

  const attrs = attributes as Record<string, unknown>;
  let schema = attrs.schema;

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    schema = {};
    attrs.schema = schema;
  }

  return schema as SchemaNode;
}

/**
 * Descend `pointer` from the schema root inside a draft. Returns the live
 * draft node, or null if any container along the path is missing or not an
 * object/array.
 */
function descendDraft(draft: Record<string, unknown>, pointer: JsonPointer): SchemaNode | null {
  const root = getSchemaDraftRoot(draft);

  if (!root) {
    return null;
  }

  const segments = parsePointer(pointer);
  let current: unknown = root;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return null;
  }

  return current && typeof current === 'object' && !Array.isArray(current) ? (current as SchemaNode) : null;
}

const TYPE_INCOMPATIBLE_KEYWORDS: Record<PrimitiveType, string[]> = {
  string: [
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  ],
  number: [
    'minLength', 'maxLength', 'pattern', 'format',
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
  ],
  integer: [
    'minLength', 'maxLength', 'pattern', 'format',
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
  ],
  boolean: [
    'minLength', 'maxLength', 'pattern', 'format',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
  ],
  null: [
    'minLength', 'maxLength', 'pattern', 'format',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
  ],
  object: [
    'minLength', 'maxLength', 'pattern', 'format',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'items', 'prefixItems', 'contains', 'minItems', 'maxItems', 'uniqueItems',
  ],
  array: [
    'minLength', 'maxLength', 'pattern', 'format',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'properties', 'required', 'additionalProperties', 'patternProperties', 'dependentRequired',
    'dependentSchemas', 'minProperties', 'maxProperties',
  ],
};

/** Set or clear the `type` on a node, removing constraint keywords that no longer apply. */
export function setType(pointer: JsonPointer, type: PrimitiveType | null): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    if (type === null) {
      delete node.type;
      return;
    }

    if (!isPrimitiveType(type)) {
      return;
    }

    node.type = type;

    for (const key of TYPE_INCOMPATIBLE_KEYWORDS[type]) {
      delete node[key];
    }
  };
}

/** Add an empty property under `parentPointer`.properties. */
export function addProp(
  parentPointer: JsonPointer,
  key: string,
  init: SchemaNode = { type: 'string' },
): SchemaUpdater {
  return (draft) => {
    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    let properties = parent.properties;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      properties = {};
      parent.properties = properties;
    }

    const props = properties as Record<string, unknown>;

    if (props[key] !== undefined) {
      return;
    }

    props[key] = init;
  };
}

/** Remove a property and any reference to it in `required`. */
export function removeProp(parentPointer: JsonPointer, key: string): SchemaUpdater {
  return (draft) => {
    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    const properties = parent.properties;

    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      delete (properties as Record<string, unknown>)[key];
    }

    const required = parent.required;

    if (Array.isArray(required)) {
      const next = required.filter((r) => r !== key);

      if (next.length === 0) {
        delete parent.required;
      } else {
        parent.required = next;
      }
    }
  };
}

/**
 * Rename a property while preserving its position in the object's key order.
 * If the new key already exists, the rename is a no-op.
 */
export function renameProp(
  parentPointer: JsonPointer,
  oldKey: string,
  newKey: string,
): SchemaUpdater {
  return (draft) => {
    if (oldKey === newKey || newKey.length === 0) {
      return;
    }

    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    const properties = parent.properties;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return;
    }

    const props = properties as Record<string, unknown>;

    if (props[oldKey] === undefined || props[newKey] !== undefined) {
      return;
    }

    const next: Record<string, unknown> = {};

    for (const k of Object.keys(props)) {
      next[k === oldKey ? newKey : k] = props[k];
    }

    parent.properties = next;

    const required = parent.required;

    if (Array.isArray(required)) {
      parent.required = (required as unknown[]).map((r): unknown =>
        typeof r === 'string' && r === oldKey ? newKey : r,
      );
    }
  };
}

/**
 * Move `key` to absolute index `toIndex` in the parent's `properties` order.
 * Out-of-range targets are clamped. Used by drag-and-drop where the drop
 * position is known directly. For arrow-key reorder, use `moveProp(...delta)`.
 */
export function movePropToIndex(
  parentPointer: JsonPointer,
  key: string,
  toIndex: number,
): SchemaUpdater {
  return (draft) => {
    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    const properties = parent.properties;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return;
    }

    const props = properties as Record<string, unknown>;
    const keys = Object.keys(props);
    const from = keys.indexOf(key);

    if (from < 0) {
      return;
    }

    const clampedTo = Math.max(0, Math.min(keys.length - 1, toIndex));

    if (clampedTo === from) {
      return;
    }

    keys.splice(from, 1);
    keys.splice(clampedTo, 0, key);

    const next: Record<string, unknown> = {};

    for (const k of keys) {
      next[k] = props[k];
    }

    parent.properties = next;
  };
}

/** Move a property up (delta=-1) or down (delta=+1) among its siblings. */
export function moveProp(parentPointer: JsonPointer, key: string, delta: number): SchemaUpdater {
  return (draft) => {
    if (delta === 0) {
      return;
    }

    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    const properties = parent.properties;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return;
    }

    const props = properties as Record<string, unknown>;
    const keys = Object.keys(props);
    const from = keys.indexOf(key);

    if (from < 0) {
      return;
    }

    const to = Math.max(0, Math.min(keys.length - 1, from + delta));

    if (to === from) {
      return;
    }

    keys.splice(from, 1);
    keys.splice(to, 0, key);

    const next: Record<string, unknown> = {};

    for (const k of keys) {
      next[k] = props[k];
    }

    parent.properties = next;
  };
}

/** Toggle whether `key` appears in the parent's `required` array. */
export function setRequired(
  parentPointer: JsonPointer,
  key: string,
  required: boolean,
): SchemaUpdater {
  return (draft) => {
    const parent = descendDraft(draft, parentPointer);

    if (!parent) {
      return;
    }

    const current = parent.required;
    const list: string[] = Array.isArray(current) ? current.filter((r): r is string => typeof r === 'string') : [];
    const has = list.includes(key);

    if (required && !has) {
      list.push(key);
    } else if (!required && has) {
      const idx = list.indexOf(key);
      list.splice(idx, 1);
    } else {
      return;
    }

    if (list.length === 0) {
      delete parent.required;
    } else {
      parent.required = list;
    }
  };
}

/**
 * Set a keyword on a node, or remove it when `value` is `undefined`. Used
 * for both standard JSON-Schema constraints and vNext `x-*` extensions.
 */
export function setKeyword(
  pointer: JsonPointer,
  keyword: string,
  value: unknown,
): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    if (value === undefined) {
      delete node[keyword];
      return;
    }

    node[keyword] = value;
  };
}

/**
 * Toggle a vNext extension on/off. Disabling deletes the key entirely;
 * enabling installs `defaultValue()`.
 */
export function toggleVNextKey(
  pointer: JsonPointer,
  xKey: string,
  defaultValue: () => unknown,
): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    if (node[xKey] !== undefined) {
      delete node[xKey];
    } else {
      node[xKey] = defaultValue();
    }
  };
}

/** Append a fresh subschema to an array composition keyword (creating the array if needed). */
export function addCompositionItem(
  pointer: JsonPointer,
  keyword: ArrayCompositionKeyword,
  init: SchemaNode = {},
): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    const current = node[keyword];

    if (Array.isArray(current)) {
      current.push(init);
    } else {
      node[keyword] = [init];
    }
  };
}

/** Remove a subschema by index from an array composition keyword; deletes the keyword when empty. */
export function removeCompositionItem(
  pointer: JsonPointer,
  keyword: ArrayCompositionKeyword,
  index: number,
): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    const current = node[keyword];

    if (!Array.isArray(current) || index < 0 || index >= current.length) {
      return;
    }

    current.splice(index, 1);

    if (current.length === 0) {
      delete node[keyword];
    }
  };
}

/** Reorder a composition item by delta within its keyword array. */
export function moveCompositionItem(
  pointer: JsonPointer,
  keyword: ArrayCompositionKeyword,
  index: number,
  delta: number,
): SchemaUpdater {
  return (draft) => {
    if (delta === 0) {
      return;
    }

    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    const list = node[keyword];

    if (!Array.isArray(list)) {
      return;
    }

    if (index < 0 || index >= list.length) {
      return;
    }

    const to = Math.max(0, Math.min(list.length - 1, index + delta));

    if (to === index) {
      return;
    }

    const removed = list.splice(index, 1);
    const item: unknown = removed[0];
    list.splice(to, 0, item);
  };
}

/** Toggle `not` between absent and a fresh empty subschema. */
export function toggleNot(pointer: JsonPointer, init: SchemaNode = {}): SchemaUpdater {
  return (draft) => {
    const node = descendDraft(draft, pointer);

    if (!node) {
      return;
    }

    if (node.not !== undefined) {
      delete node.not;
    } else {
      node.not = init;
    }
  };
}

export type { JsonPointer };
