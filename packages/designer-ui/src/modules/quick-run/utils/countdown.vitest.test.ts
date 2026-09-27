import { describe, expect, it } from 'vitest';

import { formatCountdown, scheduleCountdownLabel } from './countdown';

describe('formatCountdown', () => {
  it.each([
    [0, '0s'],
    [-5, '0s'],
    [Number.NaN, '0s'],
    [500, '1s'],
    [45_000, '45s'],
    [61_000, '1m 1s'],
    [3_720_000, '1h 2m'],
    [90_000_000, '1d 1h'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe('scheduleCountdownLabel', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  it('counts down to a future instant', () => {
    expect(scheduleCountdownLabel('2026-09-30T12:04:10Z', now)).toBe('in 4m 10s');
  });
  it('says Settling… once the instant has passed', () => {
    expect(scheduleCountdownLabel('2026-09-30T11:59:00Z', now)).toBe('Settling…');
    expect(scheduleCountdownLabel('2026-09-30T12:00:00Z', now)).toBe('Settling…');
  });
  it('returns null for an unparseable instant', () => {
    expect(scheduleCountdownLabel('not-a-date', now)).toBeNull();
  });
});
