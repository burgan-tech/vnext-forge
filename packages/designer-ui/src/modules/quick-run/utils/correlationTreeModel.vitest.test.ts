import { describe, expect, it } from 'vitest';

import type { CorrelationTreeNode } from '../types/quickrun.types';
import { allExpandableIds, defaultExpanded, flattenTree, groupSiblings, memberLabel } from './correlationTreeModel';

const n = (id: string, flow: string, state: string, children: CorrelationTreeNode[] = [], status = 'A'): CorrelationTreeNode => ({
  id, flow, domain: 'core', ownState: state, status, subFlowType: 'P', resolved: true, children,
});

const tree = n('root', 'login-flow', 'approved', [
  n('c', 'contract-flow', 'awaiting', [n('o1', 'online-flow', 'pre'), n('o2', 'online-flow', 'pre'), n('o3', 'online-flow', 'pre'), n('x', 'online-flow', 'done', [], 'C')]),
]);

describe('correlation tree model', () => {
  it('folds siblings with the same flow, state and status', () => {
    const kids = groupSiblings(tree.children[0].children);
    expect(kids.map((k) => (k.kind === 'group' ? `group:${k.members.length}` : k.node.id))).toEqual(['group:3', 'x']);
  });

  it('opens two levels by default and keeps groups closed', () => {
    const rows = flattenTree(tree, defaultExpanded);
    expect(rows.map((r) => (r.kind === 'group' ? `${r.flow}×${r.members.length}` : r.node.id))).toEqual([
      'root',
      'c',
      'online-flow×3',
      'x',
    ]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 2]);
  });

  it('lists group members when the group is expanded', () => {
    const rows = flattenTree(tree, () => true);
    expect(rows.filter((r) => r.kind === 'node').map((r) => (r.kind === 'node' ? r.node.id : ''))).toEqual(['root', 'c', 'o1', 'o2', 'o3', 'x']);
    expect(allExpandableIds(tree)).toHaveLength(3);
  });
});

describe('memberLabel', () => {
  it('uses the tail of a long key, else the id prefix', () => {
    expect(memberLabel({ ...n('o1', 'online-flow', 'pre'), key: '3098d23f-26e4-4842-9ac3-4a048d284a53-doc-DOC-CT-06bb5fe-1' })).toBe('…DOC-CT-06bb5fe-1');
    expect(memberLabel({ ...n('abcdef123456', 'online-flow', 'pre') })).toBe('abcdef12');
    expect(memberLabel({ ...n('o1', 'online-flow', 'pre'), key: 'short' })).toBe('short');
  });

  it('marks group members', () => {
    const rows = flattenTree(tree, () => true);
    expect(rows.filter((r) => r.kind === 'node' && r.inGroup).length).toBe(3);
  });
});
