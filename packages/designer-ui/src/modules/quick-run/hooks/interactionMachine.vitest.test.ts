import { describe, expect, it } from 'vitest';

import {
  INITIAL_INTERACTION,
  interactionReducer,
  remainingMs,
  shouldStopPolling,
  type AwaitingAckPhase,
  type InteractionEvent,
  type InteractionPhase,
} from './interactionMachine';

const run = (events: InteractionEvent[], start: InteractionPhase = INITIAL_INTERACTION) =>
  events.reduce(interactionReducer, start);

const paused = (nowMs = 1_000, fallbackTimeoutSeconds?: number, state = 's1'): InteractionEvent => ({
  type: 'STATE_RECEIVED',
  instanceId: 'i1',
  state,
  status: 'B',
  interaction: { terminateLongPoll: true, ack: { href: '/ack' }, ...(fallbackTimeoutSeconds !== undefined ? { fallbackTimeoutSeconds } : {}) },
  nowMs,
});

describe('interactionReducer', () => {
  it('starts polling', () => {
    expect(run([{ type: 'POLL_STARTED', instanceId: 'i1' }])).toEqual({ kind: 'polling', instanceId: 'i1' });
  });

  it('a pending interaction opens the ack window with the runtime fallback', () => {
    expect(run([{ type: 'POLL_STARTED', instanceId: 'i1' }, paused(1_000, 30)])).toEqual({
      kind: 'awaitingAck',
      instanceId: 'i1',
      stateName: 's1',
      deadlineMs: 31_000,
      fallbackTimeoutSeconds: 30,
      acking: false,
      waitingForFallback: false,
      error: null,
    });
  });

  it('defaults the fallback window to 60 s and ignores non-positive values', () => {
    expect((run([paused(0)]) as AwaitingAckPhase).deadlineMs).toBe(60_000);
    expect((run([paused(0, 0)]) as AwaitingAckPhase).deadlineMs).toBe(60_000);
  });

  it('a re-poll while awaiting keeps the original deadline', () => {
    const phase = run([paused(1_000, 30), { type: 'POLL_STARTED', instanceId: 'i1' }, paused(20_000, 30)]);
    expect((phase as AwaitingAckPhase).deadlineMs).toBe(31_000);
  });

  it('a response without interaction ends the wait (someone else acked or the fallback fired)', () => {
    expect(
      run([paused(), { type: 'STATE_RECEIVED', instanceId: 'i1', state: 's2', status: 'A', nowMs: 2_000 }]),
    ).toEqual({ kind: 'idle' });
    expect(
      run([paused(), { type: 'STATE_RECEIVED', instanceId: 'i1', state: 's2', status: 'B', nowMs: 2_000 }]),
    ).toEqual({
      kind: 'polling',
      instanceId: 'i1',
    });
  });

  it('treats A, C, F and P as stop statuses', () => {
    for (const status of ['A', 'C', 'F', 'P'] as const) {
      expect(run([{ type: 'STATE_RECEIVED', instanceId: 'i1', state: 's1', status, nowMs: 0 }])).toEqual({
        kind: 'idle',
      });
    }
  });

  it('acknowledge success resumes', () => {
    expect(run([paused(), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'ACK_SUCCEEDED', instanceId: 'i1' }])).toEqual({
      kind: 'resumed',
      instanceId: 'i1',
      stateName: 's1',
      reason: 'ack',
    });
  });

  it('acknowledge failure stays awaiting with the error', () => {
    const error = { code: 'RUNTIME_EXECUTION_FAILED', message: 'Runtime returned HTTP 403' };
    const phase = run([paused(), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'ACK_FAILED', instanceId: 'i1', error }]);
    expect(phase).toMatchObject({ kind: 'awaitingAck', acking: false, error });
  });

  it('a new ack attempt clears the previous error', () => {
    const error = { code: 'X', message: 'm' };
    const phase = run([paused(), { type: 'ACK_FAILED', instanceId: 'i1', error }, { type: 'ACK_REQUESTED', instanceId: 'i1' }]);
    expect(phase).toMatchObject({ acking: true, error: null });
  });

  it('wait for fallback is remembered', () => {
    expect(run([paused(), { type: 'WAIT_FOR_FALLBACK', instanceId: 'i1' }])).toMatchObject({ waitingForFallback: true });
  });

  it('the countdown resumes at the deadline, not before', () => {
    expect(run([paused(1_000, 10), { type: 'TICK', nowMs: 10_999 }])).toMatchObject({ kind: 'awaitingAck' });
    expect(run([paused(1_000, 10), { type: 'TICK', nowMs: 11_000 }])).toEqual({
      kind: 'resumed',
      instanceId: 'i1',
      stateName: 's1',
      reason: 'fallback',
    });
  });

  it('does not resume on the deadline while an acknowledge is in flight', () => {
    expect(run([paused(1_000, 10), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'TICK', nowMs: 20_000 }])).toMatchObject({
      kind: 'awaitingAck',
      acking: true,
    });
  });

  it('ignores ack events for another instance or outside the window', () => {
    expect(run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'other' }])).toMatchObject({ kind: 'awaitingAck' });
    expect(run([{ type: 'ACK_SUCCEEDED', instanceId: 'i1' }])).toEqual({ kind: 'idle' });
  });

  it('resumed survives the next poll request until the state changes', () => {
    const phase = run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'i1' }, { type: 'POLL_STARTED', instanceId: 'i1' }]);
    expect(phase).toEqual({ kind: 'resumed', instanceId: 'i1', stateName: 's1', reason: 'ack' });
  });

  it('reset returns to idle', () => {
    expect(run([paused(), { type: 'RESET' }])).toEqual({ kind: 'idle' });
  });

  it('remainingMs never goes negative', () => {
    const phase = run([paused(1_000, 10)]) as AwaitingAckPhase;
    expect(remainingMs(phase, 6_000)).toBe(5_000);
    expect(remainingMs(phase, 99_000)).toBe(0);
  });

  // Controller ruling F1: the runtime's fallback job can fire slightly after
  // the client-side countdown ends, so a poll right after resuming can still
  // carry `interaction.terminateLongPoll` for the same state. That must not
  // reopen `awaitingAck` (no new countdown, no stop) — only a state change or
  // leaving `B` returns the machine to ordinary polling.
  describe('resumed (controller ruling F1)', () => {
    it('resumed + same state + interaction present → stays resumed, polling continues', () => {
      const resumed = run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'i1' }]);
      const phase = interactionReducer(resumed, {
        type: 'STATE_RECEIVED',
        instanceId: 'i1',
        state: 's1',
        status: 'B',
        interaction: { terminateLongPoll: true, ack: { href: '/ack' }, fallbackTimeoutSeconds: 30 },
        nowMs: 5_000,
      });
      expect(phase).toEqual({ kind: 'resumed', instanceId: 'i1', stateName: 's1', reason: 'ack' });
      expect(shouldStopPolling(phase)).toBe(false);
    });

    it('resumed + state changed (or status not B) → normal polling phase', () => {
      const resumed = run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'i1' }]);

      const advanced = interactionReducer(resumed, {
        type: 'STATE_RECEIVED',
        instanceId: 'i1',
        state: 's2',
        status: 'B',
        interaction: { terminateLongPoll: true, ack: { href: '/ack' } },
        nowMs: 5_000,
      });
      expect(advanced).toEqual({ kind: 'polling', instanceId: 'i1' });
      expect(shouldStopPolling(advanced)).toBe(false);

      const finished = interactionReducer(resumed, {
        type: 'STATE_RECEIVED',
        instanceId: 'i1',
        state: 's1',
        status: 'C',
        nowMs: 5_000,
      });
      expect(finished).toEqual({ kind: 'idle' });
      expect(shouldStopPolling(finished)).toBe(true);
    });
  });
});

describe('shouldStopPolling', () => {
  it('stops for idle and awaitingAck; keeps polling for polling and resumed', () => {
    expect(shouldStopPolling({ kind: 'idle' })).toBe(true);
    expect(shouldStopPolling({ kind: 'polling', instanceId: 'i1' })).toBe(false);
    expect(
      shouldStopPolling({
        kind: 'awaitingAck',
        instanceId: 'i1',
        stateName: 's1',
        deadlineMs: 1,
        fallbackTimeoutSeconds: 1,
        acking: false,
        waitingForFallback: false,
        error: null,
      }),
    ).toBe(true);
    expect(shouldStopPolling({ kind: 'resumed', instanceId: 'i1', stateName: 's1', reason: 'ack' })).toBe(false);
  });
});
