import type { IncidentEntry } from '../../quick-run/QuickRunApi';
import { resolveTaskOutcome } from '../../quick-run/components/panel-kit';
import type { TaskHistoryItem } from '../../quick-run/types/quickrun.types';

/**
 * States to draw as faulted: where a task failed (an onExit task belongs to the
 * state it left, anything else to the state it ran for), plus the active
 * incident's state, which also gets the incident marker.
 */
export function faultedStatesOf(
  tasks: readonly TaskHistoryItem[],
  activeIncident: Pick<IncidentEntry, 'state'> | null,
): { faulted: string[]; incident: string[] } {
  const faulted = new Set<string>();
  for (const t of tasks) {
    if (resolveTaskOutcome(t.status, t.businessStatus) !== 'failed') continue;
    const state = t.hook === 'onExit' ? t.fromState : (t.toState ?? t.fromState);
    if (state) faulted.add(state);
  }
  const incident = activeIncident?.state ? [activeIncident.state] : [];
  for (const s of incident) faulted.add(s);
  return { faulted: [...faulted], incident };
}
