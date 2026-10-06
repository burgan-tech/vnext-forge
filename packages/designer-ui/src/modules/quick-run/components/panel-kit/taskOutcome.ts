/**
 * One verdict for a task row from the runtime's two status axes:
 * platform `status` (waiting | busy | completed | faulted) and
 * `businessStatus` (unknown | success | failed). The panels show one icon,
 * not two chips; `warning` marks the confusing case where the platform
 * completed the task but the business outcome failed.
 */
export type TaskOutcome = 'ok' | 'failed' | 'warning' | 'running' | 'unknown';

export function resolveTaskOutcome(status: string | null | undefined, businessStatus?: string | null): TaskOutcome {
  const s = (status ?? '').toLowerCase();
  const b = (businessStatus ?? '').toLowerCase();
  if (s === 'faulted') return 'failed';
  if (s === 'busy' || s === 'waiting') return 'running';
  if (s === 'completed') return b === 'failed' ? 'warning' : 'ok';
  if (b === 'failed') return 'failed';
  if (b === 'success') return 'ok';
  return 'unknown';
}

export const TASK_OUTCOME_TEXT: Record<TaskOutcome, string> = {
  ok: 'Completed',
  failed: 'Failed',
  warning: 'Completed, business outcome failed',
  running: 'Running',
  unknown: 'Unknown status',
};

/** Human wording for the runtime's task hook, given the transition it ran under. */
export function describeTaskPhase(
  hook: string | null | undefined,
  fromState: string | null | undefined,
  toState: string | null | undefined,
): string | null {
  switch (hook) {
    case 'onEntry':
      return toState ? `on entry of ${toState}` : 'on state entry';
    case 'onExit':
      return fromState ? `on exit of ${fromState}` : 'on state exit';
    case 'onExecute':
      return 'on transition';
    default:
      return null;
  }
}
