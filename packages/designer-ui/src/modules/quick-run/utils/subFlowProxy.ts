import type { CorrelationInfo } from '../types/quickrun.types';

/**
 * The SubFlow (`S`) child a transition on this instance is forwarded to.
 * Runtime 0.0.100 (#1085) forwards a transition sent to a parent with an
 * active SubFlow to the leaf, and the leaf's 400 / 403 / 409 come back
 * directly. SubProcess (`P`) children run beside the parent and are not
 * proxied.
 */
export function activeSubFlowTarget(correlations: readonly CorrelationInfo[] | undefined): CorrelationInfo | null {
  return (correlations ?? []).find((c) => !c.isCompleted && c.subFlowType.toUpperCase() === 'S') ?? null;
}
