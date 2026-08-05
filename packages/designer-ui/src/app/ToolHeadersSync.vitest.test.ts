import { describe, expect, it } from 'vitest';

import { parseInjectedToolWideHeaders } from './ToolHeadersSync';

describe('parseInjectedToolWideHeaders', () => {
  it('passes through a plain string-valued map', () => {
    expect(parseInjectedToolWideHeaders({ Authorization: 'Bearer tok', 'X-Env': 'staging' })).toEqual({
      Authorization: 'Bearer tok',
      'X-Env': 'staging',
    });
  });

  it('drops non-string entries but keeps the valid ones', () => {
    expect(parseInjectedToolWideHeaders({ Good: 'ok', Bad: 42, AlsoBad: null })).toEqual({ Good: 'ok' });
  });

  it('returns null for missing, non-object, or primitive input', () => {
    expect(parseInjectedToolWideHeaders(undefined)).toBeNull();
    expect(parseInjectedToolWideHeaders(null)).toBeNull();
    expect(parseInjectedToolWideHeaders('not-an-object')).toBeNull();
    expect(parseInjectedToolWideHeaders(42)).toBeNull();
  });

  it('returns an empty object (not null) for an object with no string entries', () => {
    expect(parseInjectedToolWideHeaders({ onlyNumber: 1 })).toEqual({});
  });
});
