import { describe, expect, it } from 'vitest';

import { instanceFingerprint, nextPollDelay, pollNeedsRefresh, shouldRefreshFromBus } from './pollSchedule';

describe('nextPollDelay', () => {
  it.each([
    [{ status: 'A', unchangedForMs: 0, visible: true, paused: false }, 3000],
    [{ status: 'B', unchangedForMs: 59_999, visible: true, paused: false }, 3000],
    [{ status: 'A', unchangedForMs: 60_000, visible: true, paused: false }, 10_000],
    [{ status: 'C', unchangedForMs: 0, visible: true, paused: false }, null],
    [{ status: 'F', unchangedForMs: 0, visible: true, paused: false }, null],
    [{ status: undefined, unchangedForMs: 0, visible: true, paused: false }, null],
    [{ status: 'A', unchangedForMs: 0, visible: false, paused: false }, null],
    [{ status: 'A', unchangedForMs: 0, visible: true, paused: true }, null],
  ])('nextPollDelay(%o) = %s', (input, expected) => {
    expect(nextPollDelay(input)).toBe(expected);
  });
});

describe('change detection', () => {
  it('fingerprints status/state even without modifiedAt', () => {
    const a = instanceFingerprint({ status: 'A', currentState: 's1', effectiveState: 's1' });
    const b = instanceFingerprint({ status: 'A', currentState: 's2', effectiveState: 's2' });
    expect(pollNeedsRefresh(a, b)).toBe(true);
    expect(pollNeedsRefresh(a, instanceFingerprint({ status: 'A', currentState: 's1', effectiveState: 's1' }))).toBe(false);
  });
  it('bus refresh ignores other instances and paused monitors', () => {
    expect(shouldRefreshFromBus(['a', 'b'], 'b', false)).toBe(true);
    expect(shouldRefreshFromBus(['a', 'b'], 'c', false)).toBe(false);
    expect(shouldRefreshFromBus(['a', 'b'], 'b', true)).toBe(false);
  });
});
