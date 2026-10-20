import type { CorrelationInfo } from '../types/quickrun.types';

/**
 * The leaf SubFlow (`S`) child a transition on this instance is forwarded to.
 * SubFlows nest (A -> B -> C) but only one `S` can be open per instance, so
 * the open `S` entries form a chain root -> leaf in order; the last one is
 * the leaf. Runtime 0.0.100 (#1085) forwards a transition sent to a parent
 * with an active SubFlow to the leaf, and the leaf's 400 / 403 / 409 come
 * back directly. SubProcess (`P`) children run beside the parent and are
 * not proxied.
 */
export function activeSubFlowTarget(correlations: readonly CorrelationInfo[] | undefined): CorrelationInfo | null {
  const openSubFlows = (correlations ?? []).filter((c) => !c.isCompleted && c.subFlowType.toUpperCase() === 'S');
  return openSubFlows[openSubFlows.length - 1] ?? null;
}
