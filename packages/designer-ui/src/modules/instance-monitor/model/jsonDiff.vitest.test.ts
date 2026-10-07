import { describe, expect, it } from 'vitest';
import { diffJson } from './jsonDiff';

describe('diffJson', () => {
  it('finds added, removed and changed leaves', () => {
    const d = diffJson(
      { a: 1, b: { c: 'x', d: true }, gone: 1 },
      { a: 2, b: { c: 'x', e: null }, list: [1] },
    );
    expect(d.changed).toEqual([{ path: 'a', oldValue: '1', newValue: '2' }]);
    expect(d.removed.map((r) => r.path).sort()).toEqual(['b.d', 'gone']);
    expect(d.added.map((r) => r.path).sort()).toEqual(['b.e', 'list[0]']);
    expect(d.unchangedCount).toBe(1);
  });
  it('treats a type change as changed at that path', () => {
    expect(diffJson({ a: { x: 1 } }, { a: 5 }).changed).toEqual([
      { path: 'a', oldValue: '{"x":1}', newValue: '5' },
    ]);
  });
  it('reports everything added when there is no previous data', () => {
    expect(diffJson(undefined, { a: 1 }).added).toEqual([{ path: 'a', value: '1' }]);
  });
  it('compares arrays by index', () => {
    const d = diffJson({ l: [1, 2] }, { l: [1, 3, 4] });
    expect(d.changed).toEqual([{ path: 'l[1]', oldValue: '2', newValue: '3' }]);
    expect(d.added).toEqual([{ path: 'l[2]', value: '4' }]);
  });
  it('reports an added empty object or array as a leaf', () => {
    expect(diffJson({}, { a: {} }).added).toEqual([{ path: 'a', value: '{}' }]);
    expect(diffJson({}, { tags: [] }).added).toEqual([{ path: 'tags', value: '[]' }]);
  });
  it('reports a removed empty array as a leaf', () => {
    expect(diffJson({ l: [] }, {}).removed).toEqual([{ path: 'l', value: '[]' }]);
  });
  it('reports inner leaves when a container is emptied', () => {
    const d = diffJson({ a: { x: 1 } }, { a: {} });
    expect(d.removed).toEqual([{ path: 'a.x', value: '1' }]);
    expect(d.added).toEqual([]);
    expect(d.changed).toEqual([]);
  });
  it('counts an unchanged empty container once', () => {
    const d = diffJson({ a: {} }, { a: {} });
    expect(d).toEqual({ added: [], removed: [], changed: [], unchangedCount: 1 });
  });
  it('distinguishes null from a missing key', () => {
    const d = diffJson({ a: null }, {});
    expect(d.removed).toEqual([{ path: 'a', value: 'null' }]);
    const e = diffJson({}, { a: null });
    expect(e.added).toEqual([{ path: 'a', value: 'null' }]);
  });
  it('is independent of key order', () => {
    const d = diffJson({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(d).toEqual({ added: [], removed: [], changed: [], unchangedCount: 2 });
  });
  it('builds paths through arrays of objects', () => {
    const d = diffJson({ items: [{ id: 1 }] }, { items: [{ id: 2 }] });
    expect(d.changed).toEqual([{ path: 'items[0].id', oldValue: '1', newValue: '2' }]);
  });
});
