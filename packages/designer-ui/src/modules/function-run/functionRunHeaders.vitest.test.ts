import { describe, expect, it } from 'vitest';

import { computeShadowedHeaderKeys, findTraceId, sanitizeHeaderRecord } from './functionRunHeaders';

describe('sanitizeHeaderRecord', () => {
  it('drops an entry whose key is blank', () => {
    expect(sanitizeHeaderRecord({ '': 'orphaned', Authorization: 'Bearer x' })).toEqual({
      Authorization: 'Bearer x',
    });
  });

  it('drops an entry whose key is whitespace-only', () => {
    expect(sanitizeHeaderRecord({ '   ': 'orphaned', 'X-Trace': '1' })).toEqual({ 'X-Trace': '1' });
  });

  it('keeps an entry with a non-blank key even when its value is blank', () => {
    // A blank *value* is meaningful (the user typed a header name and hasn't
    // filled in the value yet, or genuinely wants an empty header value) —
    // only a blank *key* has nothing to send.
    expect(sanitizeHeaderRecord({ 'X-Empty': '' })).toEqual({ 'X-Empty': '' });
  });

  it('returns an empty record for empty input', () => {
    expect(sanitizeHeaderRecord({})).toEqual({});
  });

  it('leaves an already-clean record untouched', () => {
    const input = { Authorization: 'Bearer x', 'X-Trace': '1' };
    expect(sanitizeHeaderRecord(input)).toEqual(input);
  });
});

describe('computeShadowedHeaderKeys', () => {
  it('flags a header name present in both sets', () => {
    expect(computeShadowedHeaderKeys({ Authorization: 'session-token' }, { Authorization: 'tool-token' })).toEqual([
      'Authorization',
    ]);
  });

  it('flags a key even when both layers happen to carry the same value', () => {
    // The shadow is about key *presence* on both sides, not a value
    // difference — a coincidentally-equal value still means the session
    // layer is the one that will actually be sent for that key.
    expect(computeShadowedHeaderKeys({ 'X-Trace': 'same' }, { 'X-Trace': 'same' })).toEqual(['X-Trace']);
  });

  it('does not flag a key that only exists in one of the two sets', () => {
    expect(computeShadowedHeaderKeys({ 'X-Session-Only': '1' }, { Authorization: 'tool-token' })).toEqual([]);
  });

  it('is case-sensitive, matching the plain object-spread merge it describes', () => {
    // mergeQuickRunHeaders merges via object spread, which treats
    // "authorization" and "Authorization" as two distinct keys — both would
    // ride along as separate header entries rather than one overriding the
    // other. Flagging this pair as "shadowed" would tell the user the wrong
    // thing about what actually gets sent.
    expect(computeShadowedHeaderKeys({ authorization: 'session' }, { Authorization: 'tool-wide' })).toEqual([]);
  });

  it('returns an empty array when either set is empty', () => {
    expect(computeShadowedHeaderKeys({}, { Authorization: 'tool-wide' })).toEqual([]);
    expect(computeShadowedHeaderKeys({ Authorization: 'session' }, {})).toEqual([]);
  });
});

describe('findTraceId', () => {
  it('finds the value by exact-case key', () => {
    expect(findTraceId({ 'x-trace-id': 'trace-42' })).toBe('trace-42');
  });

  it('matches case-insensitively', () => {
    expect(findTraceId({ 'X-Trace-Id': 'trace-42' })).toBe('trace-42');
  });

  it('returns null when no trace id header is present', () => {
    expect(findTraceId({ 'content-type': 'application/json' })).toBeNull();
  });

  it('returns null for an empty header set', () => {
    expect(findTraceId({})).toBeNull();
  });

  it('does not match a header that merely contains "trace" as a substring', () => {
    // A prefixed or suffixed near-miss (e.g. a custom `x-trace-id-2`) is not
    // the same header and must not be silently treated as one.
    expect(findTraceId({ 'x-trace-id-2': 'not-it' })).toBeNull();
  });
});
