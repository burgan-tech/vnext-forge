import { useQuickRunStore } from '../store/quickRunStore';
import { resolveDataTarget, type DataTarget } from '../utils/dataTarget';

/**
 * The instance every `getData` should read right now: the leaf open SubFlow
 * of the latest state round, or `own` itself. Pure over `activeState` (only
 * when it was read for `own`; another instance's chain never applies) — the
 * store's `dataTarget` only tracks resets and feeds the Data tab's label.
 * Callers compare `dataTargetKey` before and after a request and drop the
 * answer when the target moved during the round.
 */
export function currentDataTarget(own: { domain: string; workflowKey: string; instanceId: string }): DataTarget {
  const { activeState, activeStateInstanceId } = useQuickRunStore.getState();
  return resolveDataTarget(own, activeStateInstanceId === own.instanceId ? activeState : null);
}
