/**
 * Pure path-based operations on `BuilderNode` trees.
 *
 * All operations return a new tree (immutable). Paths use the encoding
 * described in `types.ts`: numeric indices walk through `children`, string
 * segments switch into a named slot (`template` or `tabs`).
 */

import {
  type BuilderDefinition,
  type BuilderNode,
  type NodePath,
} from '../types';
import { findComponentMeta } from '../palette/componentCatalog';

/** Deep clone a JSON-shaped value. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Resolve a path to the node it points at, or `null` if invalid.
 *
 * String segments switch into a named slot on the current node
 * (`template`, `tabs`, `content`, `steps`). When the slot value is
 * an array the next segment must be a number that indexes into it.
 * When the slot value is a single node we descend straight into it.
 */
export function getNode(root: BuilderNode, path: NodePath): BuilderNode | null {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof segment === 'number') {
      // Numeric segment: index either into the array we just stepped into
      // (e.g. `tabs`, `content`, `steps`) or — implicitly — into the
      // current node's `children` collection.
      const arr = Array.isArray(current) ? current : (current as BuilderNode | undefined)?.children;
      if (!Array.isArray(arr) || segment < 0 || segment >= arr.length) return null;
      current = arr[segment];
    } else if (segment === 'template') {
      const tpl = (current as { template?: BuilderNode }).template;
      if (!tpl) return null;
      current = tpl;
    } else if (segment === 'tabs') {
      const tabs = (current as { tabs?: unknown[] }).tabs;
      if (!Array.isArray(tabs)) return null;
      current = tabs;
    } else if (segment === 'content') {
      // Tab's or step's content slot — current is a tab/step wrapper object.
      const content = (current as { content?: BuilderNode[] }).content;
      if (!Array.isArray(content)) return null;
      current = content;
    } else if (segment === 'steps') {
      const steps = (current as { steps?: unknown[] }).steps;
      if (!Array.isArray(steps)) return null;
      current = steps;
    } else if (NAMED_NODE_SLOTS.has(segment)) {
      // R16.2-B: generic componentNode slot lookup (leading, trailing,
      // header, footer, anchor, actions). When the slot is an array
      // (actions) the next path segment should be a number; when it is
      // a single node we descend directly into it.
      current = (current as Record<string, unknown>)[segment] ?? null;
    } else {
      return null;
    }
    if (current === undefined || current === null) return null;
  }
  return current as BuilderNode;
}

/** R16.2-B: componentNode slot keys the builder navigates into. */
const NAMED_NODE_SLOTS = new Set(['leading', 'trailing', 'header', 'footer', 'anchor', 'actions']);

interface ParentRef {
  parent: BuilderNode | BuilderNode[];
  /** The slot key when parent is a BuilderNode (e.g. 'children', 'template'). */
  slot?: string;
  index: number | null;
}

/**
 * Resolve a path to a {parent, index} pair so we can mutate the child.
 * For root path `[]` returns `{ parent: root, index: null }`.
 */
function resolveParent(root: BuilderNode, path: NodePath): ParentRef | null {
  if (path.length === 0) return { parent: root, index: null };
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const parentNode = getParentTarget(root, parentPath);
  if (parentNode === null) return null;

  if (typeof last === 'number') {
    // Numeric index into the parent's `children` array, OR into the array
    // returned by the last slot transition.
    if (Array.isArray(parentNode)) {
      return { parent: parentNode, index: last };
    }
    return { parent: parentNode, slot: 'children', index: last };
  }
  // String segment as the final step refers to the slot itself (no mutation
  // possible on parent — caller should adjust).
  return null;
}

function getParentTarget(root: BuilderNode, path: NodePath): BuilderNode | BuilderNode[] | null {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof segment === 'number') {
      const arr = Array.isArray(current) ? current : (current as BuilderNode | undefined)?.children;
      if (!Array.isArray(arr) || segment < 0 || segment >= arr.length) return null;
      current = arr[segment];
    } else if (segment === 'template') {
      current = (current as { template?: BuilderNode }).template ?? null;
    } else if (segment === 'tabs') {
      current = (current as { tabs?: unknown[] }).tabs ?? null;
    } else if (segment === 'content') {
      current = (current as { content?: BuilderNode[] }).content ?? null;
    } else if (segment === 'steps') {
      current = (current as { steps?: unknown[] }).steps ?? null;
    } else if (NAMED_NODE_SLOTS.has(segment)) {
      current = (current as Record<string, unknown>)[segment] ?? null;
    } else {
      return null;
    }
    if (current === undefined || current === null) return null;
  }
  return current as BuilderNode | BuilderNode[];
}

/** Whether the node at `parentPath` accepts a dropped child. */
export function canDropAt(root: BuilderNode, parentPath: NodePath): boolean {
  const target = getNode(root, parentPath);
  if (!target) return false;
  const meta = findComponentMeta(target.type);
  if (!meta) return false;
  return meta.acceptsChildren;
}

/** Insert a child into the parent at the given path / index. */
export function insertChild(
  root: BuilderNode,
  parentPath: NodePath,
  index: number,
  child: BuilderNode,
): BuilderNode {
  const next = clone(root);
  const target = getNode(next, parentPath);
  if (!target) return root;
  const meta = findComponentMeta(target.type);
  if (!meta?.acceptsChildren) return root;

  if (meta.childContainerKey === 'template') {
    (target as Record<string, unknown>).template = child;
    return next;
  }
  if (meta.childContainerKey === 'tabs') {
    const tabs = ((target as { tabs?: unknown[] }).tabs ?? []) as { content?: BuilderNode[] }[];
    if (tabs.length === 0) return root;
    const firstTab = tabs[0];
    firstTab.content = firstTab.content ?? [];
    const clamped = Math.min(Math.max(index, 0), firstTab.content.length);
    firstTab.content.splice(clamped, 0, child);
    return next;
  }
  const children = (target.children ?? []);
  const clamped = Math.min(Math.max(index, 0), children.length);
  children.splice(clamped, 0, child);
  target.children = children;
  return next;
}

/** Remove the node at `path`. Returns root unchanged for invalid / root path. */
export function deleteNode(root: BuilderNode, path: NodePath): BuilderNode {
  if (path.length === 0) return root;
  const next = clone(root);
  const ref = resolveParent(next, path);
  if (ref?.index == null) return root;

  if (Array.isArray(ref.parent)) {
    ref.parent.splice(ref.index, 1);
    return next;
  }
  const children = (ref.parent.children ?? []);
  if (ref.index < 0 || ref.index >= children.length) return root;
  children.splice(ref.index, 1);
  ref.parent.children = children;
  return next;
}

/** Move a node from one path to another. Both paths reference current state. */
export function moveNode(root: BuilderNode, from: NodePath, to: NodePath, toIndex: number): BuilderNode {
  const source = getNode(root, from);
  if (!source) return root;
  // Disallow moving a node into itself or any of its descendants.
  if (isAncestor(from, to)) return root;

  const detached = deleteNode(root, from);
  // Adjust target path if necessary (when source removal shifts siblings).
  const adjustedTo = adjustPathAfterRemoval(from, to);
  const adjustedIndex = adjustIndexAfterRemoval(from, adjustedTo, toIndex);
  return insertChild(detached, adjustedTo, adjustedIndex, source);
}

function isAncestor(ancestor: NodePath, descendant: NodePath): boolean {
  if (descendant.length < ancestor.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

function adjustPathAfterRemoval(removedPath: NodePath, target: NodePath): NodePath {
  // If target shares the same parent and its index is after removedPath's last
  // index, decrement.
  if (removedPath.length === 0 || target.length === 0) return target;
  const removedParent = removedPath.slice(0, -1);
  if (removedParent.length > target.length) return target;
  // Check parents match exactly
  for (let i = 0; i < removedParent.length; i++) {
    if (removedParent[i] !== target[i]) return target;
  }
  const removedIdx = removedPath[removedPath.length - 1];
  const targetIdx = target[removedParent.length];
  if (typeof removedIdx !== 'number' || typeof targetIdx !== 'number') return target;
  if (targetIdx > removedIdx) {
    const next = target.slice();
    (next[removedParent.length] as number) = targetIdx - 1;
    return next;
  }
  return target;
}

function adjustIndexAfterRemoval(removedPath: NodePath, targetParent: NodePath, index: number): number {
  if (removedPath.length === 0) return index;
  const removedParent = removedPath.slice(0, -1);
  if (removedParent.length !== targetParent.length) return index;
  for (let i = 0; i < removedParent.length; i++) {
    if (removedParent[i] !== targetParent[i]) return index;
  }
  const removedIdx = removedPath[removedPath.length - 1];
  if (typeof removedIdx !== 'number') return index;
  return index > removedIdx ? index - 1 : index;
}

/** Update one property on the node at `path`. Setting `undefined` removes it. */
export function updateNodeProp(
  root: BuilderNode,
  path: NodePath,
  key: string,
  value: unknown,
): BuilderNode {
  const next = clone(root);
  const target = getNode(next, path);
  if (!target) return root;
  if (value === undefined || value === '' || value === null) {
    delete (target as Record<string, unknown>)[key];
  } else {
    (target as Record<string, unknown>)[key] = value;
  }
  return next;
}

/** Replace the entire node at `path`. Used for raw JSON edits. */
export function replaceNode(root: BuilderNode, path: NodePath, replacement: BuilderNode): BuilderNode {
  if (path.length === 0) return replacement;
  const next = clone(root);
  const ref = resolveParent(next, path);
  if (ref?.index == null) return root;
  if (Array.isArray(ref.parent)) {
    ref.parent[ref.index] = replacement;
    return next;
  }
  const children = (ref.parent.children ?? []);
  if (ref.index < 0 || ref.index >= children.length) return root;
  children[ref.index] = replacement;
  ref.parent.children = children;
  return next;
}

/** Duplicate the node at `path`, inserting the copy right after it. */
export function duplicateNode(root: BuilderNode, path: NodePath): BuilderNode {
  if (path.length === 0) return root;
  const target = getNode(root, path);
  if (!target) return root;
  const last = path[path.length - 1];
  if (typeof last !== 'number') return root;
  const parentPath = path.slice(0, -1);
  return insertChild(root, parentPath, last + 1, clone(target));
}

/**
 * Pick the most likely insertion point for a click-to-add gesture.
 *
 * Heuristic, matching Builder.io / Plasmic / Webflow:
 *  1. If the selected node accepts children → append inside it.
 *  2. If the selected node is a leaf → append immediately after it within
 *     its parent's children collection.
 *  3. Otherwise (no selection, root, or unrecognized parent) → append at
 *     the end of the root view's children.
 *
 * Returns `null` when the root view itself cannot accept children (rare —
 * e.g. the root was set to a leaf like Text via JSON edit).
 */
export function pickSmartInsertTarget(
  root: BuilderNode,
  selectedPath: NodePath | null,
): { parentPath: NodePath; index: number } | null {
  const rootMeta = findComponentMeta(root.type);
  const rootChildCount = ((root.children) ?? []).length;

  if (!selectedPath || selectedPath.length === 0) {
    if (!rootMeta?.acceptsChildren) return null;
    return { parentPath: [], index: rootChildCount };
  }

  const selectedNode = getNode(root, selectedPath);
  if (!selectedNode) {
    if (!rootMeta?.acceptsChildren) return null;
    return { parentPath: [], index: rootChildCount };
  }

  const selectedMeta = findComponentMeta(selectedNode.type);
  if (selectedMeta?.acceptsChildren) {
    // Append inside the selected container.
    const childCount = countChildrenForContainer(selectedNode, selectedMeta.childContainerKey);
    return { parentPath: selectedPath, index: childCount };
  }

  // Leaf selected → append as next sibling in the parent's children.
  const lastSegment = selectedPath[selectedPath.length - 1];
  if (typeof lastSegment === 'number') {
    return { parentPath: selectedPath.slice(0, -1), index: lastSegment + 1 };
  }

  // Slot-segment selected (rare); fall back to root append.
  if (!rootMeta?.acceptsChildren) return null;
  return { parentPath: [], index: rootChildCount };
}

function countChildrenForContainer(
  node: BuilderNode,
  childContainerKey: 'children' | 'template' | 'tabs' | undefined,
): number {
  if (childContainerKey === 'template') {
    return (node as { template?: BuilderNode }).template ? 1 : 0;
  }
  if (childContainerKey === 'tabs') {
    // Insert into the first tab's content.
    const tabs = (node as { tabs?: { content?: BuilderNode[] }[] }).tabs;
    return tabs?.[0]?.content?.length ?? 0;
  }
  return (node.children ?? []).length;
}

/** Convert a definition to a definition with a guaranteed root view node. */
export function ensureRootView(def: BuilderDefinition): BuilderDefinition {
  if (def.view && typeof def.view === 'object' && typeof def.view.type === 'string') {
    return def;
  }
  return { ...def, view: { type: 'Column', gap: 'md', children: [] } };
}
