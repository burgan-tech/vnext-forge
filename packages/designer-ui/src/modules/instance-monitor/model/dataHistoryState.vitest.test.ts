import { describe, expect, it } from 'vitest';

import { appendPage, mergeFirstPage, outcomeOf } from './dataHistoryState';

const r = (id: string, at: string) => ({ id, version: id, versionNo: 1, enteredAt: at, eTag: id, isLatest: false }) as never;

describe('outcomeOf', () => {
  it('maps a page', () => {
    expect(outcomeOf({ success: true, data: { items: [r('a', '2026-01-01T00:00:00Z')], page: 1, pageSize: 20, hasNext: true } })).toMatchObject({ kind: 'page', hasNext: true });
  });
  it('maps RUNTIME_NOT_FOUND to unavailable', () => {
    expect(outcomeOf({ success: false, error: { code: 'RUNTIME_NOT_FOUND', message: 'x', traceId: 't' } } as never)).toEqual({ kind: 'unavailable' });
  });
  it('maps other failures to error', () => {
    expect(outcomeOf({ success: false, error: { code: 'RUNTIME_ERROR', message: 'x', traceId: 't' } } as never).kind).toBe('error');
  });
});

describe('page merging', () => {
  const a = r('a', '2026-01-03T00:00:00Z');
  const b = r('b', '2026-01-02T00:00:00Z');
  const c = r('c', '2026-01-01T00:00:00Z');
  it('appendPage drops duplicates', () => {
    expect(appendPage([a, b], [b, c]).map((x: any) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('mergeFirstPage keeps loaded older rows below the fresh page', () => {
    const fresh = r('n', '2026-01-04T00:00:00Z');
    expect(mergeFirstPage([a, b, c], [fresh, a]).map((x: any) => x.id)).toEqual(['n', 'a', 'b', 'c']);
  });
  it('mergeFirstPage does not resurrect rows newer than the fresh window', () => {
    expect(mergeFirstPage([a, b], [b]).map((x: any) => x.id)).toEqual(['b']);
  });
});
