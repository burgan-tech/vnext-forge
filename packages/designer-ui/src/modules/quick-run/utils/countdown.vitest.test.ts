import { describe, expect, it } from 'vitest';

import { formatCountdown } from './countdown';

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
