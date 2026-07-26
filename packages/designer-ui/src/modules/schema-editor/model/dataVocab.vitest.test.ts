import { describe, expect, it } from 'vitest';

import {
  normalizeContextSource,
  serializeContextSource,
} from '../components/tree-editor/vnext/XContextSourceCard.js';
import {
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
