import { describe, expect, it } from 'vitest';

import { keepsPolling, nextKeepPollingWindow } from './keepPollingWindow';

describe('keep-polling window (interaction terminate: false)', () => {
  const block = { terminateLongPoll: false, fallbackTimeoutSeconds: 120 };

  it('opens a window from fallbackTimeoutSeconds', () => {
    const w = nextKeepPollingWindow(null, 'i1', { state: 's', interaction: block }, 1_000);
    expect(w).toEqual({ instanceId: 'i1', stateName: 's', deadlineMs: 121_000, fallbackTimeoutSeconds: 120 });
  });

  it('defaults to 60 s and ignores terminate: true or no block', () => {
    expect(nextKeepPollingWindow(null, 'i1', { state: 's', interaction: { terminateLongPoll: false } }, 0)?.deadlineMs).toBe(60_000);
    expect(nextKeepPollingWindow(null, 'i1', { state: 's', interaction: { terminateLongPoll: true } }, 0)).toBeNull();
    expect(nextKeepPollingWindow(null, 'i1', { state: 's' }, 0)).toBeNull();
  });

  it('keeps the same window while the state is unchanged and opens a new one on a new state', () => {
    const first = nextKeepPollingWindow(null, 'i1', { state: 's', interaction: block }, 0)!;
    expect(nextKeepPollingWindow(first, 'i1', { state: 's', interaction: block }, 50_000)).toBe(first);
    expect(nextKeepPollingWindow(first, 'i1', { state: 't', interaction: block }, 50_000)?.deadlineMs).toBe(170_000);
  });

  it('keeps polling until the deadline unless the instance is terminal', () => {
    const w = nextKeepPollingWindow(null, 'i1', { state: 's', interaction: block }, 0);
    expect(keepsPolling(w, 'A', 10_000)).toBe(true);
    expect(keepsPolling(w, 'B', 119_999)).toBe(true);
    expect(keepsPolling(w, 'A', 120_000)).toBe(false);
    expect(keepsPolling(w, 'C', 10_000)).toBe(false);
    expect(keepsPolling(null, 'A', 0)).toBe(false);
  });
});
