import { describe, expect, it } from 'vitest';
import { encodeTableState, decodeTableState, readTableState, writeTableState } from './table-state-url';
import type { FilterGroup } from './types';

const graphqlFilter: FilterGroup = {
  kind: 'group',
  id: 'root',
  combinator: 'and',
  children: [
    { kind: 'condition', id: 'c1', columnId: 'status', operator: 'in', value: 'Active,Busy' },
    {
      kind: 'group',
      id: 'g2',
      combinator: 'or',
      children: [
        { kind: 'condition', id: 'c2', columnId: 'key', operator: 'contains', value: 'tëst' },
      ],
    },
  ],
};

describe('table-state-url codec — graphql round-trip', () => {
  it('round-trips a nested filter + page through encode/decode', () => {
    const state = { f: graphqlFilter, p: 3 };
    const token = encodeTableState('graphql', state);
    expect(token).toBeTruthy();
    expect(token!.startsWith('g~1~')).toBe(true);
    expect(decodeTableState('graphql', token!)).toEqual(state);
  });
});

describe('table-state-url codec — query-param round-trip', () => {
  it('round-trips a flat filter map + search', () => {
    const state = { f: { 'version[eq]': '1.0', 'tags[contains]': 'x' }, q: 'abc' };
    const token = encodeTableState('query-param', state);
    expect(token).toBeTruthy();
    expect(token!.startsWith('q~1~')).toBe(true);
    expect(decodeTableState('query-param', token!)).toEqual(state);
  });

  it('round-trips a sort descriptor', () => {
    const state = { s: { by: 'createdAt', dir: 'desc' as const }, p: 2 };
    const token = encodeTableState('graphql', state)!;
    expect(decodeTableState('graphql', token)).toEqual(state);
  });
});

describe('table-state-url codec — empty + omission', () => {
  it('returns null for a fully empty bundle', () => {
    expect(encodeTableState('graphql', {})).toBeNull();
    expect(encodeTableState('graphql', { q: '   ', p: 1 })).toBeNull();
  });

  it('omits default page and blank search from the payload', () => {
    const token = encodeTableState('graphql', { f: { a: 1 }, q: '', p: 1 })!;
    expect(decodeTableState('graphql', token)).toEqual({ f: { a: 1 } });
  });
});

describe('table-state-url codec — robustness', () => {
  it('rejects a token whose mode tag does not match', () => {
    const token = encodeTableState('graphql', { f: { a: 1 } })!;
    expect(decodeTableState('query-param', token)).toBeNull();
  });

  it('rejects an unknown version', () => {
    expect(decodeTableState('graphql', 'g~9~eyJ9')).toBeNull();
  });

  it('rejects corrupt payloads', () => {
    expect(decodeTableState('graphql', 'g~1~!!!not-base64!!!')).toBeNull();
    expect(decodeTableState('graphql', 'garbage')).toBeNull();
    expect(decodeTableState('graphql', '')).toBeNull();
  });

  it('rejects a token whose payload is a JSON array', () => {
    // A well-formed g~1~ token whose base64url payload is the JSON array "[]".
    // btoa('[]') = "W10=", base64url (strip padding) = "W10"
    expect(decodeTableState('graphql', 'g~1~W10')).toBeNull();
  });
});

describe('readTableState', () => {
  it('decodes the token at the tableId param', () => {
    const token = encodeTableState('graphql', { f: { a: 1 }, p: 2 })!;
    const params = new URLSearchParams({ 'wf-instances': token, range: 'last-7d' });
    expect(readTableState(params, 'wf-instances', 'graphql')).toEqual({ f: { a: 1 }, p: 2 });
  });

  it('returns null when the param is absent or invalid', () => {
    const params = new URLSearchParams({ other: 'x' });
    expect(readTableState(params, 'wf-instances', 'graphql')).toBeNull();
  });
});

describe('writeTableState', () => {
  it('sets the token at tableId and preserves sibling params', () => {
    const params = new URLSearchParams({ range: 'last-7d', 'other-table': 'g~1~abc' });
    const next = writeTableState(params, 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(next.get('range')).toBe('last-7d');
    expect(next.get('other-table')).toBe('g~1~abc');
    expect(readTableState(next, 'wf-instances', 'graphql')).toEqual({ f: { a: 1 } });
  });

  it('deletes the param when the state is empty', () => {
    const start = writeTableState(new URLSearchParams(), 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(start.has('wf-instances')).toBe(true);
    const cleared = writeTableState(start, 'wf-instances', 'graphql', {});
    expect(cleared.has('wf-instances')).toBe(false);
  });

  it('does not mutate the input params', () => {
    const params = new URLSearchParams({ range: 'last-7d' });
    writeTableState(params, 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(params.has('wf-instances')).toBe(false);
  });
});
