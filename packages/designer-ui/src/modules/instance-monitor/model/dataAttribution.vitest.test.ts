import { describe, expect, it } from 'vitest';
import { attributeRows, otherWrites, previousRow } from './dataAttribution';

const row = (id: string, enteredAt: string) => ({
  id,
  version: '1.0.0',
  versionNo: 1,
  enteredAt,
  eTag: id,
  isLatest: false,
});
const fire = (id: string, startedAt: string, finishedAt?: string) =>
  ({
    id,
    transitionId: id,
    fromState: 'a',
    toState: 'b',
    startedAt,
    ...(finishedAt ? { finishedAt } : {}),
    triggerType: 'manual',
    createdAt: startedAt,
  }) as never;

describe('attributeRows', () => {
  const history = [
    fire('h1', '2026-10-06T10:00:00Z', '2026-10-06T10:00:02Z'),
    fire('h2', '2026-10-06T10:01:00Z'),
  ];
  const rows = [
    row('r3', '2026-10-06T10:05:00Z'),
    row('r2', '2026-10-06T10:00:30Z'),
    row('r1', '2026-10-06T10:00:01Z'),
  ];
  it('puts a row into the firing whose window contains it', () => {
    const map = attributeRows(rows, history, Date.parse('2026-10-06T10:10:00Z'));
    expect(map.get('h1')?.map((r) => r.id)).toEqual(['r1']);
    expect(map.get('h2')?.map((r) => r.id)).toEqual(['r3']); // open window runs to "now"
  });
  it('collects rows outside every window as other writes', () => {
    expect(otherWrites(rows, history, Date.parse('2026-10-06T10:10:00Z')).map((r) => r.id)).toEqual(
      ['r2'],
    );
  });
  it('finds the previous (older) row', () => {
    expect(previousRow(rows, rows[0])?.id).toBe('r2');
    expect(previousRow(rows, rows[2])).toBeNull();
  });
});
