import type { InstanceStatus, StateResponse } from '../types/quickrun.types';
import { isInactiveStatus } from '../utils/instanceStatus';
import { DEFAULT_FALLBACK_TIMEOUT_SECONDS } from './interactionMachine';

/**
 * `interaction.longPoll.terminate: false` (runtime 0.0.98+). The state does
 * not pause the pipeline and arms no ack; its `interaction` block —
 * `{ terminateLongPoll: false, fallbackTimeoutSeconds }` — tells the client
 * to keep polling for that many seconds instead of its own default. The
 * Quick Run poll loop honours it with a window opened on the first response
 * that carries the block for a state, kept (not re-opened) while the
 * instance stays in that state, and closed by a terminal status.
 */
export interface KeepPollingWindow {
  instanceId: string;
  stateName: string;
  deadlineMs: number;
  fallbackTimeoutSeconds: number;
}

export function nextKeepPollingWindow(
  current: KeepPollingWindow | null,
  instanceId: string,
  state: Pick<StateResponse, 'state' | 'interaction'>,
  nowMs: number,
): KeepPollingWindow | null {
  if (state.interaction?.terminateLongPoll !== false) return null;
  if (current && current.instanceId === instanceId && current.stateName === state.state) return current;
  const s = state.interaction.fallbackTimeoutSeconds;
  const seconds = typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : DEFAULT_FALLBACK_TIMEOUT_SECONDS;
  return { instanceId, stateName: state.state, deadlineMs: nowMs + seconds * 1000, fallbackTimeoutSeconds: seconds };
}

/** True while the window is open and the instance has not reached a terminal status. */
export function keepsPolling(window: KeepPollingWindow | null, status: InstanceStatus | undefined, nowMs: number): boolean {
  if (!window || nowMs >= window.deadlineMs) return false;
  return !(status && isInactiveStatus(status));
}
