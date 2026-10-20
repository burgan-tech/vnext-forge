import type { CorrelationInfo, StateResponse } from '../types/quickrun.types';
import { activeSubFlowTarget } from './subFlowProxy';

/** The instance whose data Quick Run should read. */
export interface DataTarget {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** The open SubFlow correlation the target came from; null = the instance itself. */
  via: CorrelationInfo | null;
}

/**
 * While a SubFlow is open the runtime shows the leaf child's view, but the
 * parent's data endpoint keeps answering for the parent. The data to show
 * belongs to the leaf, so resolve it from the open SubFlow chain.
 */
export function resolveDataTarget(
  own: { domain: string; workflowKey: string; instanceId: string },
  state: Pick<StateResponse, 'activeCorrelations'> | null | undefined,
): DataTarget {
  const leaf = activeSubFlowTarget(state?.activeCorrelations);
  if (!leaf) {
    return { domain: own.domain, workflowKey: own.workflowKey, instanceId: own.instanceId, via: null };
  }
  return {
    domain: leaf.subFlowDomain,
    workflowKey: leaf.subFlowName,
    instanceId: leaf.subFlowInstanceId,
    via: leaf,
  };
}

/** Stable identity for a data target, e.g. for cache keys and effect deps. */
export function dataTargetKey(t: Pick<DataTarget, 'domain' | 'workflowKey' | 'instanceId'>): string {
  return `${t.domain}/${t.workflowKey}/${t.instanceId}`;
}
