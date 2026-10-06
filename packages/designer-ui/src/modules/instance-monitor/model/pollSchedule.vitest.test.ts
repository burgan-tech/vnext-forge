import { describe, expect, it } from 'vitest';

import { nextPollDelay } from './pollSchedule';

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
