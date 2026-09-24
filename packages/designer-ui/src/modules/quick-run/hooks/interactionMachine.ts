import type { RuntimeErrorLike } from '../components/RuntimeErrorBanner';
import type { InstanceStatus, InteractionSignal } from '../types/quickrun.types';
import { stopsPolling } from '../utils/instanceStatus';

/**
 * Long-poll interaction (`interaction.longPoll.terminate: true`), spec D3.
 *
 * The runtime pauses after the triggering transition and keeps the instance
 * `B` until the client acknowledges or `fallbackTimeoutSeconds` elapses; the
 * state function carries `interaction` only while an ack is pending. The
 * client stops polling, shows the view and a countdown, and offers
 * Acknowledge / Wait for fallback. After a successful ack or the countdown's
 * expiry the runtime's chain returns to `A` and runs the remaining steps —
 * the client must keep polling.
 *
 * Controller ruling F1: the runtime's fallback job can fire slightly after
 * the client-side countdown ends, so a poll issued right after "resume" can
 * still carry the `interaction` block for the *same* state. Re-entering
 * `awaitingAck` on that stale flag would re-open a countdown for an ack
 * window that already closed. Instead, `ACK_SUCCEEDED` / the deadline tick
 * moves the machine into `resumed`, which records the state name current at
 * that moment. While `resumed` and the incoming state name is unchanged (and
 * the instance is still `B`), a `STATE_RECEIVED` carrying
 * `interaction.terminateLongPoll` is ignored — no new countdown, no stop.
 * `resumed` is left (back to ordinary polling, or terminal) only once the
 * state name changes or the status leaves `B`. `POLL_STARTED` does not by
 * itself leave `resumed` — only the following response does — so the guard
 * survives the in-flight request that reads the stale flag.
 *
 *   idle ─POLL_STARTED→ polling ─STATE_RECEIVED(pending)→ awaitingAck
 *   awaitingAck ─ACK_SUCCEEDED | TICK≥deadline→ resumed
 *   resumed ─STATE_RECEIVED(same state, still B)→ resumed (interaction ignored)
 *   resumed ─STATE_RECEIVED(state changed | status≠B)→ polling | idle
 */

export const DEFAULT_FALLBACK_TIMEOUT_SECONDS = 60;

export interface AwaitingAckPhase {
  kind: 'awaitingAck';
  instanceId: string;
  /** The state the runtime paused in — carried into `resumed` for the F1 guard. */
  stateName: string;
  /** Epoch ms at which the runtime's fallback resumes the pipeline. */
  deadlineMs: number;
  fallbackTimeoutSeconds: number;
  /** An acknowledge request is in flight. */
  acking: boolean;
  /** The user chose "Wait for fallback". */
  waitingForFallback: boolean;
  /** Last acknowledge failure, shown until the next attempt. */
  error: RuntimeErrorLike | null;
}

/**
 * Entered right after an ack succeeds or the fallback deadline passes.
 * Polling continues, but a stale `interaction` flag for the same state must
 * not reopen `awaitingAck` (controller ruling F1) — see the module doc.
 */
export interface ResumedPhase {
  kind: 'resumed';
  instanceId: string;
  stateName: string;
  reason: 'ack' | 'fallback';
}

export type InteractionPhase =
  | { kind: 'idle' }
  | { kind: 'polling'; instanceId: string }
  | AwaitingAckPhase
  | ResumedPhase;

export type InteractionEvent =
  | { type: 'POLL_STARTED'; instanceId: string }
  | {
      type: 'STATE_RECEIVED';
      instanceId: string;
      state: string;
      status: InstanceStatus;
      interaction?: InteractionSignal;
      nowMs: number;
    }
  | { type: 'ACK_REQUESTED'; instanceId: string }
  | { type: 'ACK_SUCCEEDED'; instanceId: string }
  | { type: 'ACK_FAILED'; instanceId: string; error: RuntimeErrorLike }
  | { type: 'WAIT_FOR_FALLBACK'; instanceId: string }
  | { type: 'TICK'; nowMs: number }
  | { type: 'RESET' };

export const INITIAL_INTERACTION: InteractionPhase = { kind: 'idle' };

function fallbackSeconds(signal: InteractionSignal | undefined): number {
  const s = signal?.fallbackTimeoutSeconds;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : DEFAULT_FALLBACK_TIMEOUT_SECONDS;
}

function awaitingFor(phase: InteractionPhase, instanceId: string): AwaitingAckPhase | null {
  return phase.kind === 'awaitingAck' && phase.instanceId === instanceId ? phase : null;
}

function resumedFor(phase: InteractionPhase, instanceId: string): ResumedPhase | null {
  return phase.kind === 'resumed' && phase.instanceId === instanceId ? phase : null;
}

/** Normal next phase once `resumed`'s guard no longer applies. */
function pollingOrIdle(instanceId: string, status: InstanceStatus): InteractionPhase {
  return stopsPolling(status) ? INITIAL_INTERACTION : { kind: 'polling', instanceId };
}

export function interactionReducer(phase: InteractionPhase, event: InteractionEvent): InteractionPhase {
  switch (event.type) {
    case 'RESET':
      return INITIAL_INTERACTION;

    case 'POLL_STARTED': {
      // A re-read while an ack is pending, or right after resuming, keeps the
      // phase — the response decides whether to leave it.
      const awaiting = awaitingFor(phase, event.instanceId);
      if (awaiting) return awaiting;
      const resumed = resumedFor(phase, event.instanceId);
      if (resumed) return resumed;
      return { kind: 'polling', instanceId: event.instanceId };
    }

    case 'STATE_RECEIVED': {
      const resumed = resumedFor(phase, event.instanceId);
      if (resumed) {
        // F1 guard: same state, still Busy → the fallback job's stale flag
        // (or a plain still-busy poll) does not reopen awaitingAck or stop.
        if (event.state === resumed.stateName && event.status === 'B') return resumed;
        return pollingOrIdle(event.instanceId, event.status);
      }

      if (event.interaction?.terminateLongPoll === true) {
        const existing = awaitingFor(phase, event.instanceId);
        if (existing) return existing;
        const seconds = fallbackSeconds(event.interaction);
        return {
          kind: 'awaitingAck',
          instanceId: event.instanceId,
          stateName: event.state,
          deadlineMs: event.nowMs + seconds * 1000,
          fallbackTimeoutSeconds: seconds,
          acking: false,
          waitingForFallback: false,
          error: null,
        };
      }
      return pollingOrIdle(event.instanceId, event.status);
    }

    case 'ACK_REQUESTED': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, acking: true, error: null } : phase;
    }

    case 'ACK_SUCCEEDED': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting
        ? { kind: 'resumed', instanceId: event.instanceId, stateName: awaiting.stateName, reason: 'ack' }
        : phase;
    }

    case 'ACK_FAILED': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, acking: false, error: event.error } : phase;
    }

    case 'WAIT_FOR_FALLBACK': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, waitingForFallback: true } : phase;
    }

    case 'TICK':
      if (phase.kind === 'awaitingAck' && !phase.acking && event.nowMs >= phase.deadlineMs) {
        return { kind: 'resumed', instanceId: phase.instanceId, stateName: phase.stateName, reason: 'fallback' };
      }
      return phase;
  }
}

export function remainingMs(phase: AwaitingAckPhase, nowMs: number): number {
  return Math.max(0, phase.deadlineMs - nowMs);
}

/**
 * Pure stop decision for the poll loop (Task 5): stop while a terminal
 * status has been reached (`idle`) or while an acknowledge is pending
 * (`awaitingAck`). Keep polling for `polling` and for `resumed` — `resumed`
 * still polls, it only suppresses re-entering `awaitingAck` on a stale flag.
 */
export function shouldStopPolling(phase: InteractionPhase): boolean {
  return phase.kind === 'idle' || phase.kind === 'awaitingAck';
}
