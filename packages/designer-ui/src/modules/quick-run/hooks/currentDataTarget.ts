import { useQuickRunStore } from '../store/quickRunStore';
import { resolveDataTarget, type DataTarget } from '../utils/dataTarget';

/**
 * The instance every `getData` should read right now: the leaf open SubFlow
 * of the latest state round, or `own` itself. Pure over `activeState` — the
 * store's `dataTarget` only tracks resets and feeds the Data tab's label.
 * Callers compare `dataTargetKey` before and after a request and drop the
 * answer when the target moved during the round.
 */
export function currentDataTarget(own: { domain: string; workflowKey: string; instanceId: string }): DataTarget {
  return resolveDataTarget(own, useQuickRunStore.getState().activeState);
}
