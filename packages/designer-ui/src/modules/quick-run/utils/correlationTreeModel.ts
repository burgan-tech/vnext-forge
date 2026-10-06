import type { CorrelationTreeNode } from '../types/quickrun.types';

/**
 * View model of the correlation tree. Siblings that run the same flow in the
 * same state with the same status (typically fan-out / SubProcess loops) are
 * folded into one "flow ×N" group row; expanding the group lists them.
 */
export type TreeRow =
  | {
      kind: 'node';
      id: string;
      depth: number;
      node: CorrelationTreeNode;
      hasChildren: boolean;
      parentId: string | null;
      isRoot: boolean;
      /** Member of a "flow ×N" group: identified by its key, not its flow. */
      inGroup: boolean;
    }
  | { kind: 'group'; id: string; depth: number; flow: string; state: string | null; status: string | null; subFlowType: string | null; members: CorrelationTreeNode[]; parentId: string | null };

type Child = { kind: 'node'; node: CorrelationTreeNode } | { kind: 'group'; key: string; members: CorrelationTreeNode[] };

export function nodeState(node: CorrelationTreeNode): string | null {
  return node.ownState ?? node.currentState ?? null;
}

/** Folds siblings with the same flow, state, type and status into groups (first-seen order). */
export function groupSiblings(children: readonly CorrelationTreeNode[]): Child[] {
  const out: Child[] = [];
  const byKey = new Map<string, Extract<Child, { kind: 'group' }>>();
  const keyOf = (n: CorrelationTreeNode) => [n.domain, n.flow, nodeState(n), n.subFlowType ?? '', n.status ?? ''].join('|');
  const counts = new Map<string, number>();
  for (const c of children) counts.set(keyOf(c), (counts.get(keyOf(c)) ?? 0) + 1);
  for (const c of children) {
    const key = keyOf(c);
    if ((counts.get(key) ?? 0) < 2) {
      out.push({ kind: 'node', node: c });
      continue;
    }
    const existing = byKey.get(key);
    if (existing) existing.members.push(c);
    else {
      const group = { kind: 'group' as const, key, members: [c] };
      byKey.set(key, group);
      out.push(group);
    }
  }
  return out;
}

const nodeId = (node: CorrelationTreeNode, parentId: string | null) =>
  `${parentId ?? ''}/${node.id || node.correlationId || node.flow}`;

/** Default expansion: the root and its direct children are open, groups closed. */
export function defaultExpanded(id: string, depth: number, kind: TreeRow['kind']): boolean {
  return kind === 'node' && depth < 2;
}

/**
 * The visible rows in display order. `isExpanded(id, depth, kind)` decides
 * which rows show their children.
 */
export function flattenTree(
  root: CorrelationTreeNode,
  isExpanded: (id: string, depth: number, kind: TreeRow['kind']) => boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walkNode = (node: CorrelationTreeNode, depth: number, parentId: string | null, isRoot: boolean, inGroup = false) => {
    const id = nodeId(node, parentId);
    rows.push({ kind: 'node', id, depth, node, hasChildren: node.children.length > 0, parentId, isRoot, inGroup });
    if (node.children.length > 0 && isExpanded(id, depth, 'node')) walkChildren(node.children, depth + 1, id);
  };
  const walkChildren = (children: readonly CorrelationTreeNode[], depth: number, parentId: string) => {
    for (const child of groupSiblings(children)) {
      if (child.kind === 'node') {
        walkNode(child.node, depth, parentId, false);
        continue;
      }
      const first = child.members[0];
      const id = `${parentId}/group:${child.key}`;
      rows.push({
        kind: 'group',
        id,
        depth,
        flow: first.flow,
        state: nodeState(first),
        status: first.status ?? null,
        subFlowType: first.subFlowType ?? null,
        members: child.members,
        parentId,
      });
      if (isExpanded(id, depth, 'group')) for (const m of child.members) walkNode(m, depth + 1, id, false, true);
    }
  };
  walkNode(root, 0, null, true);
  return rows;
}

/** Every expandable row id of the tree, for "Expand all". */
export function allExpandableIds(root: CorrelationTreeNode): string[] {
  return flattenTree(root, () => true)
    .filter((r) => (r.kind === 'node' ? r.hasChildren : true))
    .map((r) => r.id);
}

/**
 * Short distinguishing label of a group member: the tail of its business key
 * (keys of fan-out children share a long prefix), else the first id block.
 */
export function memberLabel(node: CorrelationTreeNode): string {
  const key = node.key ?? '';
  if (key && key !== node.id) return key.length > 18 ? `…${key.slice(-16)}` : key;
  return node.id ? node.id.slice(0, 8) : node.flow;
}
