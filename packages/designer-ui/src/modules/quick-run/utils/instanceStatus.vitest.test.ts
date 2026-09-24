import { describe, expect, it } from 'vitest';

import { displayStatus, isActiveStatus, isInactiveStatus } from './instanceStatus';

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
