import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatCountdown } from './countdown';

export interface TaskGroup {
  key: string;
  transitionKey: string;
  fromState: string;
  toState: string | null;
  items: TaskHistoryItem[];
}

/**
 * Consecutive journal rows of the same transition (key + from/to state) form
 * one group. Rows arrive StartedAt ascending, so a transition fired twice
 * yields two groups.
 */
export function groupTasksByTransition(items: readonly TaskHistoryItem[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  for (const item of items) {
    const toState = item.toState ?? null;
    const last = groups[groups.length - 1];
    if (last?.transitionKey === item.transitionKey && last.fromState === item.fromState && last.toState === toState) {
      last.items.push(item);
      continue;
    }
    groups.push({ key: `${groups.length}:${item.transitionKey}`, transitionKey: item.transitionKey, fromState: item.fromState, toState, items: [item] });
  }
  return groups;
}

export function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return formatCountdown(ms);
}

export type TaskTone = 'success' | 'danger' | 'busy' | 'neutral';

/** Tone for a platform status (waiting|busy|completed|faulted) or business status (unknown|success|failed). */
export function taskStatusTone(status: string): TaskTone {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'success';
    case 'faulted':
    case 'failed':
      return 'danger';
    case 'busy':
    case 'waiting':
      return 'busy';
    default:
      return 'neutral';
  }
}
