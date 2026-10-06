import type { CorrelationTreeNode, CorrelationTreeResponse } from '../../quick-run/types/quickrun.types';
import { lookupComponent, type ComponentIndex } from './componentIndex';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { workflowFilePath: _parentFile, ...rest } = parent;
  return { ...rest, domain: node.domain, workflowKey: node.flow, instanceId: node.id, ...(workflowFilePath ? { workflowFilePath } : {}) };
}

/** The child's local workflow file; only same-domain children, because the index is keyed by key alone. */
export function childWorkflowFile(index: ComponentIndex, level: MonitorTarget, node: CorrelationTreeNode): string | undefined {
  if (node.domain !== level.domain) return undefined;
  return lookupComponent(index, 'workflows', node.flow) ?? undefined;
}
