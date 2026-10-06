import type { CorrelationTreeNode, CorrelationTreeResponse } from '../../quick-run/types/quickrun.types';
import type { MonitorTarget } from '../types';

/** Depth-first lookup by instance id. */
export function findCorrelationNode(tree: CorrelationTreeResponse | null, instanceId: string): CorrelationTreeNode | null {
  if (!tree) return null;
  const stack: CorrelationTreeNode[] = [tree.root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === instanceId) return node;
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return null;
}

/** Children of `instanceId` that were started from `stateKey`. */
export function childInstancesOf(tree: CorrelationTreeResponse | null, instanceId: string, stateKey: string): CorrelationTreeNode[] {
  return findCorrelationNode(tree, instanceId)?.children.filter((c) => c.parentState === stateKey) ?? [];
}

/** Target for drilling into a child instance; keeps the parent's environment. */
export function childTarget(parent: MonitorTarget, node: CorrelationTreeNode, workflowFilePath?: string): MonitorTarget {
  const next: MonitorTarget = { ...parent, domain: node.domain, workflowKey: node.flow, instanceId: node.id, ...(workflowFilePath ? { workflowFilePath } : {}) };
  if (!workflowFilePath) delete next.workflowFilePath;
  return next;
}
