import type { ExecutionOverlay } from '../../canvas-interaction/context/CanvasModeContext';
import type { LabelView } from '../../canvas-interaction/readonly/view-types';
import { stateVisitCounts } from '../../canvas-interaction/utils/executionOverlay';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

export function toExecutionOverlay(
  history: readonly HistoryTransition[],
  currentState: string | null,
  pathOnly: boolean,
  focus: ExecutionOverlay['focus'] = null,
  faults?: { faulted: string[]; incident: string[] },
): ExecutionOverlay {
  return {
    traversedTransitions: history.map((t) => ({ transitionId: t.transitionId, fromState: t.fromState, toState: t.toState })),
    currentState,
    pathOnly,
    focus,
    faultedStates: faults?.faulted ?? [],
    incidentStates: faults?.incident ?? [],
  };
}

export interface StateVisitSummary {
  visits: number;
  isCurrent: boolean;
}

export function summarizeState(
  history: readonly HistoryTransition[],
  stateKey: string,
  currentState: string | null,
): StateVisitSummary {
  const visits = stateVisitCounts(toExecutionOverlay(history, currentState, false)).get(stateKey) ?? 0;
  return { visits, isCurrent: currentState === stateKey };
}

export function describeStateVisits({ visits, isCurrent }: StateVisitSummary): string {
  if (visits === 0) return isCurrent ? 'Now here' : 'Not visited';
  const base = visits === 1 ? 'Visited once' : `Visited ${visits}×`;
  return isCurrent ? `${base} · now here` : base;
}

export function transitionFirings(history: readonly HistoryTransition[], transitionKey: string): HistoryTransition[] {
  return history.filter((t) => t.transitionId === transitionKey);
}

export function describeFirings(count: number): string {
  if (count === 0) return 'Not fired';
  return count === 1 ? 'Fired once' : `Fired ${count}×`;
}

/** en-US first, then the first label, then the fallback — Quick Run's rule. */
export function pickLabel(labels: readonly LabelView[] | undefined, fallback: string): string {
  if (!labels?.length) return fallback;
  return labels.find((l) => l.language === 'en-US')?.label || labels[0].label || fallback;
}
