import { describe, expect, it } from 'vitest';

import { displayStatus, isActiveStatus, isInactiveStatus, stopsPolling } from './instanceStatus';

describe('instanceStatus', () => {
  it('prefers effectiveStatus', () => {
    expect(displayStatus({ status: 'B', effectiveStatus: 'A' })).toBe('A');
  });

  it('falls back to status on older runtimes', () => {
    expect(displayStatus({ status: 'B' })).toBe('B');
  });

  it('buckets every status exactly once', () => {
    for (const s of ['A', 'B', 'C', 'F', 'P'] as const) {
      expect(isActiveStatus(s) !== isInactiveStatus(s)).toBe(true);
    }
    expect(isInactiveStatus('P')).toBe(true);
  });
});

describe('stopsPolling', () => {
  it('stops on A, C, F and Passive; keeps polling on B', () => {
    expect(['A', 'C', 'F', 'P'].every((s) => stopsPolling(s as 'A'))).toBe(true);
    expect(stopsPolling('B')).toBe(false);
  });
});
