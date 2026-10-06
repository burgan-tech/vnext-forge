import { describe, expect, it } from 'vitest';
import { attributeRows, compareOrder, otherWrites, previousRow, rowLabel } from './dataAttribution';

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
  it('attributes a row exactly on a window bound (inclusive)', () => {
    const h = [fire('hb', '2026-10-06T10:00:00Z', '2026-10-06T10:00:10Z')];
    const rs = [row('end', '2026-10-06T10:00:10Z'), row('start', '2026-10-06T10:00:00Z')];
    const map = attributeRows(rs, h, Date.parse('2026-10-06T11:00:00Z'));
    expect(map.get('hb')?.map((r) => r.id)).toEqual(['end', 'start']);
  });
  it('gives a row strictly inside an overlap to the latest-starting firing', () => {
    const h = [
      fire('outer', '2026-10-06T10:00:00Z', '2026-10-06T10:10:00Z'),
      fire('inner', '2026-10-06T10:02:00Z', '2026-10-06T10:03:00Z'),
    ];
    const map = attributeRows(
      [row('x', '2026-10-06T10:02:30Z')],
      h,
      Date.parse('2026-10-06T11:00:00Z'),
    );
    expect(map.get('inner')?.map((r) => r.id)).toEqual(['x']);
    expect(map.has('outer')).toBe(false);
  });
  it('gives a row on the later firing start to the earlier firing when chained in one millisecond', () => {
    const h = [
      fire('first', '2026-10-06T10:00:00.000Z', '2026-10-06T10:00:00.050Z'),
      fire('second', '2026-10-06T10:00:00.050Z', '2026-10-06T10:00:00.200Z'),
    ];
    const map = attributeRows(
      [row('boundary', '2026-10-06T10:00:00.050Z')],
      h,
      Date.parse('2026-10-06T11:00:00Z'),
    );
    expect(map.get('first')?.map((r) => r.id)).toEqual(['boundary']);
    expect(map.has('second')).toBe(false);
  });
  it('still gives a start-bound row to its firing when no earlier firing contains it', () => {
    const h = [
      fire('first', '2026-10-06T10:00:00Z', '2026-10-06T10:00:01Z'),
      fire('second', '2026-10-06T10:00:05Z', '2026-10-06T10:00:09Z'),
    ];
    const map = attributeRows([row('s', '2026-10-06T10:00:05Z')], h, Date.parse('2026-10-06T11:00:00Z'));
    expect(map.get('second')?.map((r) => r.id)).toEqual(['s']);
  });
});

describe('compareOrder / rowLabel', () => {
  const vrow = (id: string, version: string, versionNo: number, enteredAt: string) =>
    ({ id, version, versionNo, enteredAt, eTag: id, isLatest: false }) as never;
  // newest first; version line 1.1.0 restarted VersionNo at 1, older line 1.0.0 reached #4.
  const rows = [
    vrow('n', '1.1.0', 2, '2026-10-06T12:00:00Z'),
    vrow('m', '1.1.0', 1, '2026-10-06T11:00:00Z'),
    vrow('o', '1.0.0', 4, '2026-10-06T10:00:00Z'),
  ];
  it('orders by enteredAt, not versionNo, across version lines', () => {
    const [a, b] = compareOrder(rows, rows[2]!, rows[1]!);
    expect([a.id, b.id]).toEqual(['o', 'm']);
    const [c, d] = compareOrder(rows, rows[0]!, rows[2]!);
    expect([c.id, d.id]).toEqual(['o', 'n']);
  });
  it('breaks enteredAt ties by list position (newest-first list: later index is older)', () => {
    const t = [vrow('x', '1.0.0', 2, '2026-10-06T10:00:00Z'), vrow('y', '1.0.0', 1, '2026-10-06T10:00:00Z')];
    const [a, b] = compareOrder(t, t[0]!, t[1]!);
    expect([a.id, b.id]).toEqual(['y', 'x']);
  });
  it('labels rows with version line and number', () => {
    expect(rowLabel(rows[2]!)).toBe('v1.0.0 #4');
  });
});
