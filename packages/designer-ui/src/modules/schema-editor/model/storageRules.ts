/**
 * Design-time mirror of the runtime's `x-storage` publish rules (runtime
 * 0.0.100 `FileStorageSchemaParser`, vnext-docs `schema-definition.md#x-storage`):
 *
 * - on a property reached through nested `properties`, or on the `items` of
 *   ONE array level reached that way — not the root, `$defs`, combinators,
 *   conditionals or nested arrays;
 * - not inside another file node;
 * - the node is `type: "object"`;
 * - the node describes the stored handle, so it must not declare `content`
 *   under `properties` or `required`;
 * - `binding` is a non-empty string (the only member).
 *
 * The package validates only the shape (master role); placement is a publish
 * error at the runtime, which is why Forge checks it here.
 */
import { parsePointer, type JsonPointer } from './jsonPointer';
import { getNodeAt, getSchemaRoot, type SchemaNode } from './schemaNode';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isObjectType(type: unknown): boolean {
  return type === 'object' || (Array.isArray(type) && type.includes('object') && type.every((t) => t === 'object' || t === 'null'));
}

/** Placement problem of a file node at `pointer`, or `null` when the location is allowed. */
export function storageLocationIssue(schemaRoot: SchemaNode | null, pointer: JsonPointer): string | null {
  const segments = parsePointer(pointer);
  if (segments.length === 0) return 'x-storage cannot sit on the schema root.';
  let node: unknown = schemaRoot;
  let arrayLevels = 0;
  let i = 0;
  while (i < segments.length) {
    const segment = segments[i]!;
    if (segment === 'properties' && i + 1 < segments.length) {
      node = isRecord(node) && isRecord(node.properties) ? node.properties[segments[i + 1]!] : undefined;
      i += 2;
    } else if (segment === 'items') {
      arrayLevels++;
      if (arrayLevels > 1) return 'x-storage is allowed on the items of one array level only, not in nested arrays.';
      node = isRecord(node) ? node.items : undefined;
      i += 1;
    } else {
      return 'x-storage is allowed only on fields reached through nested properties (or one array level’s items) — not under $defs, combinators or conditionals.';
    }
    if (i < segments.length && isRecord(node) && node['x-storage'] !== undefined) {
      return 'x-storage cannot sit inside another file field.';
    }
  }
  return null;
}

/** Why the runtime would reject the `x-storage` at `pointer`; empty when fine or absent. */
export function storageIssues(componentJson: Record<string, unknown> | null | undefined, pointer: JsonPointer): string[] {
  if (!componentJson) return [];
  const node = getNodeAt(componentJson, pointer);
  const storage = node?.['x-storage'];
  if (!node || storage === undefined) return [];
  const issues: string[] = [];

  const location = storageLocationIssue(getSchemaRoot(componentJson), pointer);
  if (location) issues.push(location);
  if (!isObjectType(node.type)) issues.push('A file field must be type "object" (it stores the file handle).');

  const declaresContent =
    (isRecord(node.properties) && node.properties.content !== undefined) ||
    (Array.isArray(node.required) && node.required.includes('content'));
  if (declaresContent) {
    issues.push(
      'The schema describes the stored handle, which never carries content; remove content from properties / required (give the transition its own schema for the upload shape).',
    );
  }
  if (!isRecord(storage) || typeof storage.binding !== 'string' || storage.binding.trim() === '') {
    issues.push('x-storage needs a binding: the blob storage component the runtime writes to.');
  }
  return issues;
}

/**
 * Persisted handle the runtime writes in place of the bytes. Offered as the
 * field's shape when it becomes a file field; `additionalProperties` stays
 * open so the runtime-only members (`component`, `file`, `eTag`, `owner`)
 * validate without being listed.
 */
export function fileHandleShape(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      name: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'integer' },
    },
  };
}
