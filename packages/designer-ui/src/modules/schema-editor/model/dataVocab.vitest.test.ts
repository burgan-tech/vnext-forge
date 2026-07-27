import { describe, expect, it } from 'vitest';

import {
  normalizeContextSource,
  serializeContextSource,
} from '../components/tree-editor/vnext/XContextSourceCard.js';
import {
  applyTargetRowChange,
  normalizeContextTarget,
  serializeContextTarget,
} from '../components/tree-editor/vnext/XContextTargetCard.js';

describe('x-context-source normalize/serialize', () => {
  it('round-trips a context slot', () => {
    const v = normalizeContextSource({
      context: { boundary: 'user', key: 'profile:{subject}', storage: 'secure' },
    });
    expect(v.shape).toBe('context');
    expect(serializeContextSource(v)).toEqual({
      context: { boundary: 'user', key: 'profile:{subject}', storage: 'secure' },
    });
  });

  it('round-trips an identity ref', () => {
    const v = normalizeContextSource({ identity: 'subject' });
    expect(v.shape).toBe('identity');
    expect(serializeContextSource(v)).toEqual({ identity: 'subject' });
  });

  it('round-trips a const literal', () => {
    const v = normalizeContextSource({ const: 42 });
    expect(v.shape).toBe('const');
    expect(serializeContextSource(v)).toEqual({ const: 42 });
  });

  it('omits storage when not set on a context slot', () => {
    const v = normalizeContextSource({ context: { boundary: 'device', key: 'device:{id}' } });
    expect(v.shape).toBe('context');
    expect(serializeContextSource(v)).toEqual({ context: { boundary: 'device', key: 'device:{id}' } });
  });

  it('falls back to the context shape with defaults for unrecognized input', () => {
    const v = normalizeContextSource(undefined);
    expect(v.shape).toBe('context');
    expect(v.boundary).toBe('user');
    expect(v.key).toBe('');
  });
});

describe('x-context-target normalize/serialize', () => {
  it('round-trips a path→slot map', () => {
    const rows = normalizeContextTarget({
      'profile.name': { context: { boundary: 'user', key: 'name:{instance}' } },
    });
    expect(rows).toHaveLength(1);
    expect(serializeContextTarget(rows)).toEqual({
      'profile.name': { context: { boundary: 'user', key: 'name:{instance}' } },
    });
  });

  it('drops rows with an empty path', () => {
    expect(serializeContextTarget([{ path: '', boundary: 'user', key: 'x' }])).toEqual({});
  });

  it('preserves storage when set and omits it when absent', () => {
    const rows = normalizeContextTarget({
      a: { context: { boundary: 'device', key: 'a:{device}', storage: 'local' } },
      b: { context: { boundary: 'subject', key: 'b:{subject}' } },
    });
    expect(rows).toHaveLength(2);
    expect(serializeContextTarget(rows)).toEqual({
      a: { context: { boundary: 'device', key: 'a:{device}', storage: 'local' } },
      b: { context: { boundary: 'subject', key: 'b:{subject}' } },
    });
  });

  it('drops malformed entries (missing context) instead of throwing', () => {
    const rows = normalizeContextTarget({ bogus: { notContext: true } });
    expect(rows).toEqual([]);
  });
});

describe('applyTargetRowChange (row-list editor reducer)', () => {
  it('adding a row to a list that already has a valid row yields 2 rows, the first untouched', () => {
    const rows = [{ path: 'profile.name', boundary: 'user' as const, key: 'name:{instance}' }];
    const next = applyTargetRowChange(rows, { type: 'add' });

    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(rows[0]);
    expect(next[1]).toEqual({ path: '', boundary: 'user', key: '' });
  });

  it('editing a non-path field of a blank row keeps the row present (does not drop it)', () => {
    const rows = [{ path: '', boundary: 'user' as const, key: '' }];
    const next = applyTargetRowChange(rows, {
      type: 'update',
      index: 0,
      patch: { boundary: 'device' },
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toEqual({ path: '', boundary: 'device', key: '' });
    // Confirms the bug scenario: serializing this in-flight row still
    // drops it from the persisted map (path is empty) even though the
    // reducer itself must keep it on screen.
    expect(serializeContextTarget(next)).toEqual({});
  });

  it('removing a row by index leaves the others untouched and re-indexed', () => {
    const rows = [
      { path: 'a', boundary: 'user' as const, key: 'a:{x}' },
      { path: 'b', boundary: 'device' as const, key: 'b:{y}' },
      { path: 'c', boundary: 'subject' as const, key: 'c:{z}' },
    ];
    const next = applyTargetRowChange(rows, { type: 'remove', index: 1 });

    expect(next).toEqual([
      { path: 'a', boundary: 'user', key: 'a:{x}' },
      { path: 'c', boundary: 'subject', key: 'c:{z}' },
    ]);
  });
});
