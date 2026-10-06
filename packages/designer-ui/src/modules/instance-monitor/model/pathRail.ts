import { findTransition } from '../../canvas-interaction/readonly/normalize';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import { resolveTaskOutcome } from '../../quick-run/components/panel-kit';
import type { HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { pickLabel } from './monitorPath';

export type PathRailTrigger = 'manual' | 'automatic' | 'scheduled' | 'event' | 'other';

export interface PathRailStep {
  order: number;
  historyId: string;
  transitionKey: string;
  label: string;
  fromState: string;
  toState: string;
  startedAt: string;
  durationMs: number | null;
  trigger: PathRailTrigger;
  failedTasks: number;
  wroteData: boolean;
}

export function normalizeTrigger(triggerType: string | null | undefined): PathRailTrigger {
  switch ((triggerType ?? '').trim().toLowerCase()) {
    case 'manual':
      return 'manual';
    case 'automatic':
    case 'auto':
      return 'automatic';
    case 'scheduled':
    case 'timer':
      return 'scheduled';
    case 'event':
    case 'signal':
      return 'event';
    default:
      return 'other';
  }
}

export function pathRailSteps(
  history: readonly HistoryTransition[],
  ctx: { tasks: readonly TaskHistoryItem[]; vm: WorkflowViewModel; rowsByFiring?: ReadonlyMap<string, readonly DataHistoryItem[]> },
): PathRailStep[] {
  return history.map((t, i) => {
    const start = Date.parse(t.startedAt);
    const next = history[i + 1];
    const end = t.finishedAt
      ? Date.parse(t.finishedAt)
      : next
        ? Date.parse(next.startedAt)
        : Number.POSITIVE_INFINITY;
    const failedTasks = ctx.tasks.filter((task) => {
      if (task.transitionKey !== t.transitionId || task.fromState !== t.fromState || (task.toState ?? t.toState) !== t.toState) return false;
      const at = Date.parse(task.startedAt);
      if (!(at >= start)) return false;
      const inside = t.finishedAt ? at <= end : at < end;
      return inside && resolveTaskOutcome(task.status, task.businessStatus) === 'failed';
    }).length;
    return {
      order: i + 1,
      historyId: t.id,
      transitionKey: t.transitionId,
      label: pickLabel(findTransition(ctx.vm, t.transitionId)?.labels, t.transitionId),
      fromState: t.fromState,
      toState: t.toState,
      startedAt: t.startedAt,
      durationMs: t.durationSeconds != null ? t.durationSeconds * 1000 : null,
      trigger: normalizeTrigger(t.triggerType),
      failedTasks,
      wroteData: (ctx.rowsByFiring?.get(t.id)?.length ?? 0) > 0,
    };
  });
}

export function railSummary(steps: readonly PathRailStep[]): { count: number; totalMs: number | null; failedSteps: number } {
  // A partial total would read as complete, so any unknown duration makes the total unknown.
  const complete = steps.length > 0 && steps.every((s) => s.durationMs !== null);
  return {
    count: steps.length,
    totalMs: complete ? steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) : null,
    failedSteps: steps.filter((s) => s.failedTasks > 0).length,
  };
}
