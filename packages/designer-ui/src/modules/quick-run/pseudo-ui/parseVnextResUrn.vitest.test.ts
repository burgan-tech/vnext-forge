import { describe, expect, it } from 'vitest';

import { RES_KEYS, RES_KEY_TO_FLOW, parseVnextResUrn } from './parseVnextResUrn';

describe('parseVnextResUrn (R26)', () => {
  it('returns null for empty / non-string input', () => {
    expect(parseVnextResUrn(undefined)).toBeNull();
    expect(parseVnextResUrn(null)).toBeNull();
    expect(parseVnextResUrn('')).toBeNull();
    expect(parseVnextResUrn('   ')).toBeNull();
    expect(parseVnextResUrn(42 as unknown as string)).toBeNull();
  });

  it('parses every res-key happy path', () => {
    for (const resKey of RES_KEYS) {
      const urn = `urn:vnext:res:${resKey}:core:my-${resKey}`;
      expect(parseVnextResUrn(urn)).toEqual({
        resKey,
        domain: 'core',
        key: `my-${resKey}`,
      });
    }
  });

  it('captures an optional version suffix', () => {
    expect(
      parseVnextResUrn('urn:vnext:res:schema:core:input-schema:1.0.0'),
    ).toEqual({
      resKey: 'schema',
      domain: 'core',
      key: 'input-schema',
      version: '1.0.0',
    });
  });

  it('rejects URNs with an unknown res-key', () => {
    expect(parseVnextResUrn('urn:vnext:res:widget:core:foo')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:component:core:foo')).toBeNull();
  });

  it('rejects malformed segment counts', () => {
    expect(parseVnextResUrn('urn:vnext:res:schema:core')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:schema')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:schema:core:key:v:extra')).toBeNull();
  });

  it('rejects empty segments', () => {
    expect(parseVnextResUrn('urn:vnext:res::core:key')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:schema::key')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:schema:core:')).toBeNull();
    expect(parseVnextResUrn('urn:vnext:res:schema:core:key:')).toBeNull();
  });

  it('hard cut: rejects all urn:amorphie:res:* legacy URNs', () => {
    const legacy = [
      'urn:amorphie:res:schema:core:input-schema',
      'urn:amorphie:res:component:core:branch-selection',
      'urn:amorphie:res:schema:core:input-schema:1.0.0',
    ];
    for (const urn of legacy) {
      expect(parseVnextResUrn(urn)).toBeNull();
    }
  });

  it('rejects non-URN strings (no fallback path)', () => {
    expect(parseVnextResUrn('input-schema')).toBeNull();
    expect(parseVnextResUrn('https://schemas.vnext.com/core/input.json')).toBeNull();
  });

  it('strips whitespace before classification', () => {
    expect(parseVnextResUrn('  urn:vnext:res:view:onboarding:account-summary  ')).toEqual({
      resKey: 'view',
      domain: 'onboarding',
      key: 'account-summary',
    });
  });

  it('exposes the res-key → flow lookup for resolvers', () => {
    expect(RES_KEY_TO_FLOW.schema).toBe('sys-schemas');
    expect(RES_KEY_TO_FLOW.flow).toBe('sys-flows');
    expect(RES_KEY_TO_FLOW.extension).toBe('sys-extensions');
    expect(RES_KEY_TO_FLOW.function).toBe('sys-functions');
    expect(RES_KEY_TO_FLOW.view).toBe('sys-views');
    expect(RES_KEY_TO_FLOW.task).toBe('sys-tasks');
  });
});
