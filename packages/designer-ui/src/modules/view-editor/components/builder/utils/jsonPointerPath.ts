/**
 * Bidirectional converter between the pseudo-ui SDK's JSON Pointer
 * representation and the Builder store's internal `NodePath` array.
 *
 * The SDK's `<PseudoView designer="edit">` mode emits paths as JSON
 * Pointer strings (`data-pseudo-path`, delegate callbacks):
 *
 *   /view
 *   /view/children/0
 *   /view/children/0/template
 *   /view/children/0/tabs/0/content/1
 *
 * Forge's builder store keeps view-relative `NodePath = (number|string)[]`
 * arrays. Numeric segments are *implicit* children indices; string
 * segments are explicit container keys (currently supported by
 * `nodeOps.getNode`: `'template'`, `'tabs'`, `'content'`).
 *
 *   []                            ← /view
 *   [0]                           ← /view/children/0
 *   [0, 'template']               ← /view/children/0/template
 *   [0, 'tabs', 0, 'content', 1]  ← /view/children/0/tabs/0/content/1
 *
 * Unsupported pointer segments (`actions`, `leading`, `trailing`,
 * `header`, `anchor`, `steps`) return `null` from the parser — callers
 * should treat null as a no-op (e.g. silently skip an SDK-initiated
 * drop into a slot the store cannot represent yet). Extending the
 * NodePath vocabulary to cover those slots is a Faz 2 task.
 */

import type { NodePath } from '../types';

/** Container keys that resolve to an *array* in the live view tree. */
const ARRAY_CONTAINER_KEYS = new Set(['tabs', 'content', 'steps', 'actions']);

/**
 * Container keys we currently support in the NodePath model.
 *
 * R16.2-B extends the set with named componentNode slots: `leading`,
 * `trailing`, `header`, `footer`, `anchor`, and the `actions` array.
 * Together with `template` / `tabs` / `content` / `steps` this covers
 * every nested-node slot the view vocabulary declares. nodeOps reads
 * `node[segment]` generically, so adding a new slot only requires the
 * allowlist entry here.
 */
const SUPPORTED_STRING_SEGMENTS = new Set([
  'template',
  'tabs',
  'content',
  'steps',
  'leading',
  'trailing',
  'header',
  'footer',
  'anchor',
  'actions',
]);

/**
 * Build a SDK-compatible JSON Pointer from a builder `NodePath`.
 *
 * Numeric segments imply traversal into the previous parent's
 * `children` array unless the previous segment was an array-yielding
 * key (`tabs`, `content`, `steps`), in which case the numeric is a
 * direct index into that array.
 *
 * Always succeeds for well-formed store paths.
 */
export function nodePathToJsonPointer(path: NodePath): string {
  let pointer = '/view';
  let arrayContext = false;
  for (const segment of path) {
    if (typeof segment === 'number') {
      pointer += arrayContext ? `/${segment}` : `/children/${segment}`;
      arrayContext = false;
    } else {
      pointer += `/${segment}`;
      arrayContext = ARRAY_CONTAINER_KEYS.has(segment);
    }
  }
  return pointer;
}

/**
 * Parse an SDK JSON Pointer into a builder `NodePath`.
 *
 * Returns `null` when the pointer references a slot the store cannot
 * mutate today (Button.actions, ListTile.leading/trailing,
 * AppBar.header, ForEach.anchor, …). Callers must handle null by
 * skipping the SDK event (with a log if useful).
 */
export function jsonPointerToNodePath(pointer: string): NodePath | null {
  if (typeof pointer !== 'string') return null;
  if (pointer === '/view') return [];
  if (!pointer.startsWith('/view/')) return null;

  const segments = pointer.slice('/view/'.length).split('/');
  const result: (number | string)[] = [];
  let arrayContext = false;
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];

    if (/^\d+$/.test(seg)) {
      // Numeric segments without an explicit container key only make
      // sense in array context. If we land here in node context, the
      // pointer is malformed for our model.
      if (!arrayContext) return null;
      result.push(Number(seg));
      arrayContext = false;
      i += 1;
      continue;
    }

    if (seg === 'children') {
      // `children/N` collapses to a single numeric segment in NodePath.
      const next = segments[i + 1];
      if (typeof next !== 'string' || !/^\d+$/.test(next)) return null;
      result.push(Number(next));
      arrayContext = false;
      i += 2;
      continue;
    }

    if (SUPPORTED_STRING_SEGMENTS.has(seg)) {
      result.push(seg);
      arrayContext = ARRAY_CONTAINER_KEYS.has(seg);
      i += 1;
      continue;
    }

    // Unsupported slot key (actions, leading, trailing, header, anchor)
    return null;
  }

  return result;
}
