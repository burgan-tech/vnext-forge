/**
 * Typed accessors over a JSON-Schema node. The canonical in-memory form is
 * still a `Record<string, unknown>` (so unknown keys passthrough); these
 * helpers project a read-only view for the UI without mutating shape.
 */

import { getAt, type JsonPointer } from './jsonPointer';

export const PRIMITIVE_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
] as const;

export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

export function isPrimitiveType(value: string): value is PrimitiveType {
  return (PRIMITIVE_TYPES as readonly string[]).includes(value);
}

export type SchemaNode = Record<string, unknown>;

export interface SchemaSourceContainer {
  attributes?: { schema?: SchemaNode };
}

/**
 * Pointer (within componentJson) of the schema root. Selection pointers are
 * relative to this root, so a selection of "/properties/foo" resolves to
 * `componentJson.attributes.schema.properties.foo`.
 */
export const SCHEMA_DOC_ROOT_KEYS = ['attributes', 'schema'] as const;

export function getSchemaRoot(componentJson: Record<string, unknown> | null | undefined): SchemaNode | null {
  if (!componentJson) {
    return null;
  }

  const attributes = componentJson.attributes;

  if (!attributes || typeof attributes !== 'object') {
    return null;
  }

  const schema = (attributes as Record<string, unknown>).schema;

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return null;
  }

  return schema as SchemaNode;
}

/**
 * Resolve a schema-relative pointer against the componentJson's schema root.
 */
export function getNodeAt(
  componentJson: Record<string, unknown> | null | undefined,
  pointer: JsonPointer,
): SchemaNode | null {
  const root = getSchemaRoot(componentJson);

  if (!root) {
    return null;
  }

  const value = getAt(root, pointer);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as SchemaNode;
}

export function getNodeType(node: SchemaNode | null | undefined): PrimitiveType | null {
  if (!node) {
    return null;
  }

  const raw = node.type;

  return typeof raw === 'string' && isPrimitiveType(raw) ? raw : null;
}

export function isObjectNode(node: SchemaNode | null | undefined): boolean {
  return getNodeType(node) === 'object' || (!!node && typeof node.properties === 'object');
}

export function isArrayNode(node: SchemaNode | null | undefined): boolean {
  return getNodeType(node) === 'array' || (!!node && (node.items !== undefined || node.prefixItems !== undefined));
}

/**
 * One-line summary used by SubschemaCard when rendering a composition item.
 */
export function summarizeNode(node: SchemaNode | null | undefined): string {
  if (!node) {
    return '(empty)';
  }

  const parts: string[] = [];
  const type = getNodeType(node);

  if (type) {
    parts.push(type);
  }

  if (node.const !== undefined) {
    parts.push(`const: ${JSON.stringify(node.const)}`);
  }

  if (Array.isArray(node.enum)) {
    parts.push(`enum: ${node.enum.length}`);
  }

  const properties = node.properties;

  if (properties && typeof properties === 'object') {
    parts.push(`${Object.keys(properties).length} props`);
  }

  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    const value = node[keyword];

    if (Array.isArray(value) && value.length > 0) {
      parts.push(`${keyword}: ${value.length}`);
    }
  }

  if (node.not) {
    parts.push('not');
  }

  return parts.length === 0 ? '(any)' : parts.join(', ');
}

/**
 * Names of properties under `node.properties`, preserving insertion order.
 */
export function getPropertyKeys(node: SchemaNode | null | undefined): string[] {
  if (!node) {
    return [];
  }

  const properties = node.properties;

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return [];
  }

  return Object.keys(properties as Record<string, unknown>);
}

export function isRequiredKey(node: SchemaNode | null | undefined, key: string): boolean {
  if (!node) {
    return false;
  }

  const required = node.required;

  return Array.isArray(required) && required.includes(key);
}
