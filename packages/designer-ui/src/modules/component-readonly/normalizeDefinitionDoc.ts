/**
 * The monitor API's /components/definition endpoint returns component
 * documents in a FLATTENED shape (type/config/content/… at the top level)
 * while the designer editors read the canonical `attributes.*` nesting.
 * This adapter accepts either shape and returns the canonical one.
 * Mirrors the approach of canvas-interaction/readonly/normalize.ts.
 */

export type ReadonlyComponentType =
  | 'task'
  | 'extension'
  | 'function'
  | 'mapping'
  | 'schema'
  | 'view';

const COMMON_TOP_LEVEL = new Set([
  'key',
  'version',
  'domain',
  'flow',
  'flowVersion',
  'tags',
  '_comment',
  'labels',
]);

/** Per type: which top-level keys belong inside `attributes` (aliases map source→attr key). */
const ATTR_KEYS: Record<ReadonlyComponentType, Record<string, string>> = {
  task: { type: 'type', config: 'config' },
  extension: { type: 'type', scope: 'scope', definedFlows: 'definedFlows', task: 'task' },
  function: {
    scope: 'scope',
    task: 'task',
    onExecutionTasks: 'onExecutionTasks',
    output: 'output',
    rawResponse: 'rawResponse',
    cache: 'cache',
  },
  mapping: { name: 'name', location: 'location', code: 'code', script: 'code', encoding: 'encoding' },
  schema: { type: 'type', schema: 'schema' },
  view: {
    type: 'type',
    display: 'display',
    renderer: 'renderer',
    content: 'content',
    labels: 'labels',
  },
};

export function normalizeDefinitionDoc(
  type: ReadonlyComponentType,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const existingAttrs = raw.attributes;
  if (existingAttrs && typeof existingAttrs === 'object') return raw;

  const attrs: Record<string, unknown> = {};
  const doc: Record<string, unknown> = {};
  const aliasMap = ATTR_KEYS[type];

  for (const [key, value] of Object.entries(raw)) {
    if (COMMON_TOP_LEVEL.has(key) && !(type === 'view' && key === 'labels')) {
      doc[key] = value;
    } else if (key in aliasMap) {
      if (attrs[aliasMap[key]] === undefined) attrs[aliasMap[key]] = value;
    } else {
      doc[key] = value; // unknown keys stay top-level (forward compatible)
    }
  }

  doc.attributes = attrs;
  return doc;
}
