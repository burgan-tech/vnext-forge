import { describe, expect, it } from 'vitest';

import { resolveTransitionKey } from './resolveTransitionKey';

describe('resolveTransitionKey (R26 — vNext URNs)', () => {
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

  it('extracts state from vNext current-instance transition URN', () => {
    expect(
      resolveTransitionKey('urn:vnext:flow:transition:onboarding:kyc-main-flow:approved'),
    ).toBe('approved');
  });

  it('extracts state from vNext with-instance transition URN', () => {
    expect(
      resolveTransitionKey('urn:vnext:flow:transition:onboarding:kyc-main-flow:inst-1:approved'),
    ).toBe('approved');
  });

  it('extracts the final slash segment from an HTTPS URL form', () => {
    expect(
      resolveTransitionKey('https://api.example.com/transitions/loan/approve'),
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

  it('returns null for vNext function URNs — they are not transitions', () => {
    expect(resolveTransitionKey('urn:vnext:fn:get:shared:get-cities')).toBeNull();
    expect(resolveTransitionKey('urn:vnext:fn:onboarding:kyc:inst-1:cust')).toBeNull();
  });

  it('returns null for vNext flow-start URNs — they are not transitions', () => {
    expect(resolveTransitionKey('urn:vnext:flow:start:onboarding:kyc-main-flow')).toBeNull();
  });

  it('legacy urn:amorphie:* falls back to last-segment via the unknown branch', () => {
    expect(
      resolveTransitionKey('urn:amorphie:wf:loan-flow:transition:approve'),
    ).toBe('approve');
    expect(
      resolveTransitionKey('urn:amorphie:transition:customer:registration:submit'),
    ).toBe('submit');
  });
});
