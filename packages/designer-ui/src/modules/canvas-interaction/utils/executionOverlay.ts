import type { ExecutionOverlay } from '../context/CanvasModeContext';

export const START_NODE_ID = '__start__';
/** `fromState` of the start transition's history row (runtime ≥ 0.0.99). */
export const RUNTIME_START_STATE = '$start';

export type NodeExecutionStatus = 'current' | 'visited' | 'unreachable';
export type EdgeExecutionStatus = 'traversed' | 'untaken';

export interface NodeExecutionData {
  executionStatus: NodeExecutionStatus;
  visitCount: number;
  pathOnly: boolean;
  /** Present (and true) only when focused — never overrides a search spotlight with `false`. */
  spotlight?: true;
}

export interface EdgeExecutionData {
  executionStatus: EdgeExecutionStatus;
  /** 1-based positions of this edge in the path, oldest first. */
  pathOrder: number[];
  pathOnly: boolean;
  spotlight?: true;
}

export interface EdgePathOrders {
  bySource: Map<string, number[]>;
  byKey: Map<string, number[]>;
}

/** Canvas node id a history `fromState` leaves from. */
export function canvasSourceId(fromState: string): string {
  return fromState === RUNTIME_START_STATE ? START_NODE_ID : fromState;
}

export function overlayEdgeKey(sourceId: string, transitionKey: string): string {
  return `${sourceId}::${transitionKey}`;
}

/**
 * How many times each state was entered. A state the path leaves but never
 * enters (the first state of a history without a `$start` row) counts once.
 */
export function stateVisitCounts(overlay: ExecutionOverlay): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of overlay.traversedTransitions) counts.set(t.toState, (counts.get(t.toState) ?? 0) + 1);
  for (const t of overlay.traversedTransitions) {
    if (t.fromState !== RUNTIME_START_STATE && !counts.has(t.fromState)) counts.set(t.fromState, 1);
  }
  return counts;
}

/** Path positions per edge: by source + key, and by key alone for workflow-level edges. */
export function edgePathOrders(overlay: ExecutionOverlay): EdgePathOrders {
  const bySource = new Map<string, number[]>();
  const byKey = new Map<string, number[]>();
  overlay.traversedTransitions.forEach((t, i) => {
    const sourceKey = overlayEdgeKey(canvasSourceId(t.fromState), t.transitionId);
    bySource.set(sourceKey, [...(bySource.get(sourceKey) ?? []), i + 1]);
    byKey.set(t.transitionId, [...(byKey.get(t.transitionId) ?? []), i + 1]);
  });
  return { bySource, byKey };
}

export function nodeExecutionData(
  nodeId: string,
  overlay: ExecutionOverlay,
  visits: Map<string, number>,
): NodeExecutionData | null {
  if (nodeId.startsWith(START_NODE_ID) || nodeId.startsWith('__wf_')) return null;
  const visitCount = visits.get(nodeId) ?? 0;
  const executionStatus: NodeExecutionStatus =
    overlay.currentState === nodeId ? 'current' : visitCount > 0 ? 'visited' : 'unreachable';
  const focused = overlay.focus?.kind === 'state' && overlay.focus.key === nodeId;
  return { executionStatus, visitCount, pathOnly: overlay.pathOnly === true, ...(focused ? { spotlight: true as const } : {}) };
}

/**
 * Workflow-level edges (cancel / exit / timeout / updateData / shared) start at
 * a `__wf_*` node the runtime never names, so they match by key alone.
 */
export function edgeExecutionData(
  source: string,
  transitionKey: string | undefined,
  orders: EdgePathOrders,
  overlay: ExecutionOverlay,
): EdgeExecutionData {
  const pathOrder = !transitionKey
    ? []
    : (orders.bySource.get(overlayEdgeKey(source, transitionKey)) ??
      (source.startsWith('__wf_') ? orders.byKey.get(transitionKey) : undefined) ??
      []);
  const focused = !!transitionKey && overlay.focus?.kind === 'transition' && overlay.focus.key === transitionKey;
  return {
    executionStatus: pathOrder.length > 0 ? 'traversed' : 'untaken',
    pathOrder,
    pathOnly: overlay.pathOnly === true,
    ...(focused ? { spotlight: true as const } : {}),
  };
}
