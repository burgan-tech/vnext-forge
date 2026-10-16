import { isFileUploadNode } from '../utils/fileFields';

/** Marker the QuickRun file widget matches on (schema-form extensions only see the property). */
export const FILE_FIELD_MARKER = 'x-forge-file';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Copy of a transition / start schema with {@link FILE_FIELD_MARKER} on its
 * file upload nodes: nodes at a master-schema `x-storage` path, or with the
 * upload shape (`name` + `content`). The input is not modified. Returns the
 * input itself when nothing is marked.
 */
export function markFileFields<T>(schema: T, masterPaths: readonly string[]): T {
  if (!isRecord(schema)) return schema;
  let marked = false;
  const walk = (node: unknown, path: string, arrays: number): unknown => {
    if (!isRecord(node)) return node;
    if (path !== '' && isFileUploadNode(node, path, masterPaths)) {
      marked = true;
      return { ...node, [FILE_FIELD_MARKER]: true };
    }
    let next: Record<string, unknown> = node;
    if (isRecord(node.properties)) {
      const props: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.properties)) props[key] = walk(child, path ? `${path}.${key}` : key, arrays);
      next = { ...next, properties: props };
    }
    if (arrays === 0 && path !== '' && isRecord(node.items)) {
      next = { ...next, items: walk(node.items, `${path}[]`, arrays + 1) };
    }
    return next;
  };
  const result = walk(schema, '', 0);
  return (marked ? result : schema) as T;
}

/**
 * `instance` without values at the file fields `markedSchema` marks. Sample
 * data generators fill an upload node with fake `name` / `size` / `content`
 * (not base64), which the runtime would reject; a file must be picked.
 */
export function stripFileFieldValues(instance: unknown, markedSchema: unknown): unknown {
  const walk = (value: unknown, node: unknown): unknown => {
    if (!isRecord(node) || !isRecord(value)) return value;
    const props = isRecord(node.properties) ? node.properties : {};
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childNode = props[key];
      if (isRecord(childNode) && childNode[FILE_FIELD_MARKER] === true) continue;
      if (isRecord(childNode) && isRecord(childNode.items) && childNode.items[FILE_FIELD_MARKER] === true) continue;
      out[key] = walk(child, childNode);
    }
    return out;
  };
  return walk(instance, markedSchema);
}
