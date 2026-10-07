import { describe, expect, it } from 'vitest';

import { PendingFocusStore } from './pending-focus';

describe('PendingFocusStore', () => {
  it('returns a parked id once and clears it', () => {
    const s = new PendingFocusStore();
    s.set('d:wf', 'i1');
    expect(s.take('d:wf')).toBe('i1');
    expect(s.take('d:wf')).toBeUndefined();
  });
  it('keeps only the latest request per key', () => {
    const s = new PendingFocusStore();
    s.set('d:wf', 'i1');
    s.set('d:wf', 'i2');
    s.set('d:other', 'x');
    expect(s.take('d:wf')).toBe('i2');
    expect(s.take('d:other')).toBe('x');
  });
  it('returns undefined for unknown keys', () => {
    expect(new PendingFocusStore().take('nope')).toBeUndefined();
  });
});
