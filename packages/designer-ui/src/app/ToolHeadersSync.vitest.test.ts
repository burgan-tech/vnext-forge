import { afterEach, describe, expect, it, vi } from 'vitest';

import { areToolHeadersHostOwned, parseInjectedToolWideHeaders } from './ToolHeadersSync';

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

describe('areToolHeadersHostOwned', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is host-owned when the host injected a non-empty header map', () => {
    vi.stubGlobal('window', { __VNEXT_CONFIG__: { globalHeaders: { Authorization: 'Bearer tok' } } });
    expect(areToolHeadersHostOwned()).toBe(true);
  });

  it('is still host-owned when the host injected an empty header map', () => {
    // An injected `{}` is still the host's own choice ("no headers"), not
    // the absence of one — only a missing key means nothing was injected.
    vi.stubGlobal('window', { __VNEXT_CONFIG__: { globalHeaders: {} } });
    expect(areToolHeadersHostOwned()).toBe(true);
  });

  it('is not host-owned when __VNEXT_CONFIG__ exists but has no globalHeaders key', () => {
    vi.stubGlobal('window', { __VNEXT_CONFIG__: { someOtherKey: 1 } });
    expect(areToolHeadersHostOwned()).toBe(false);
  });

  it('is not host-owned when globalHeaders is present but not an object', () => {
    vi.stubGlobal('window', { __VNEXT_CONFIG__: { globalHeaders: 'not-an-object' } });
    expect(areToolHeadersHostOwned()).toBe(false);
  });

  it('is not host-owned when there is no __VNEXT_CONFIG__ at all', () => {
    vi.stubGlobal('window', {});
    expect(areToolHeadersHostOwned()).toBe(false);
  });

  it('is not host-owned when there is no window at all', () => {
    // This package's own test environment: no DOM, no global `window`. The
    // web shell's actual runtime always has a `window`, but never sets
    // `__VNEXT_CONFIG__` — this case exists so the function is safely
    // callable from a render/test path that has neither.
    expect(typeof window).toBe('undefined');
    expect(areToolHeadersHostOwned()).toBe(false);
  });
});
