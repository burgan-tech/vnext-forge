import { describe, expect, it } from 'vitest';

import { resolveTransitionKey } from './resolveTransitionKey';

describe('resolveTransitionKey (R24)', () => {
  it('returns null for empty / undefined / non-string input', () => {
    expect(resolveTransitionKey(undefined)).toBeNull();
    expect(resolveTransitionKey(null)).toBeNull();
    expect(resolveTransitionKey('')).toBeNull();
    expect(resolveTransitionKey('   ')).toBeNull();
    expect(resolveTransitionKey(42 as unknown as string)).toBeNull();
  });

  it('returns the raw key when input is not a URN', () => {
    expect(resolveTransitionKey('approve')).toBe('approve');
    expect(resolveTransitionKey('  approve  ')).toBe('approve');
    expect(resolveTransitionKey('my-transition')).toBe('my-transition');
  });

  it('extracts the final colon segment from a 5-segment Amorphie URN (legacy)', () => {
    expect(
      resolveTransitionKey('urn:amorphie:transition:retail:loan:approve'),
    ).toBe('approve');
  });

  it('extracts the final colon segment from a 6-segment Amorphie URN (canonical)', () => {
    expect(
      resolveTransitionKey('urn:amorphie:transition:customer:registration:inst-001:submit'),
    ).toBe('submit');
  });

  it('extracts the final slash segment from an HTTPS URL form', () => {
    expect(
      resolveTransitionKey('https://api.example.com/transitions/loan/approve'),
    ).toBe('approve');
  });

  it('extracts the final slash segment from a vnext URN', () => {
    expect(
      resolveTransitionKey('urn:vnext:transitions/loan-flow/approve'),
    ).toBe('approve');
  });

  it('handles mixed-separator URNs by taking the absolute last segment', () => {
    expect(
      resolveTransitionKey('urn:vnext:transitions/loan:complete'),
    ).toBe('complete');
  });

  it('returns the original URN when no tail segment is found', () => {
    // urn: with empty body — degenerate; we don't crash, just give it
    // back so the caller can surface a meaningful error.
    expect(resolveTransitionKey('urn:')).toBe('urn:');
  });
});
