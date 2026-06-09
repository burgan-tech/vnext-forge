import { describe, expect, it } from 'vitest';

import { parseVnextUrn } from './parseVnextUrn';

describe('parseVnextUrn (R26)', () => {
  it('returns null for empty / non-string input', () => {
    expect(parseVnextUrn(undefined)).toBeNull();
    expect(parseVnextUrn(null)).toBeNull();
    expect(parseVnextUrn('')).toBeNull();
    expect(parseVnextUrn('   ')).toBeNull();
    expect(parseVnextUrn(42 as unknown as string)).toBeNull();
  });

  it('classifies raw transition keys', () => {
    expect(parseVnextUrn('approve')).toEqual({ kind: 'raw', value: 'approve' });
    expect(parseVnextUrn('  my-transition  ')).toEqual({ kind: 'raw', value: 'my-transition' });
  });

  describe('flow-start', () => {
    it('parses urn:vnext:flow:start:<domain>:<flow>', () => {
      expect(parseVnextUrn('urn:vnext:flow:start:onboarding:kyc-main-flow')).toEqual({
        kind: 'flow-start',
        domain: 'onboarding',
        flow: 'kyc-main-flow',
        raw: 'urn:vnext:flow:start:onboarding:kyc-main-flow',
      });
    });

    it('rejects malformed start URNs as unknown', () => {
      expect(parseVnextUrn('urn:vnext:flow:start:onlydomain')).toEqual({
        kind: 'unknown',
        raw: 'urn:vnext:flow:start:onlydomain',
      });
      expect(parseVnextUrn('urn:vnext:flow:start::flow')).toEqual({
        kind: 'unknown',
        raw: 'urn:vnext:flow:start::flow',
      });
    });
  });

  describe('flow-transition', () => {
    it('parses with-instance form (5 segments)', () => {
      expect(
        parseVnextUrn('urn:vnext:flow:transition:onboarding:kyc-main-flow:inst-001:approved'),
      ).toEqual({
        kind: 'flow-transition',
        domain: 'onboarding',
        flow: 'kyc-main-flow',
        instance: 'inst-001',
        transition: 'approved',
        raw: 'urn:vnext:flow:transition:onboarding:kyc-main-flow:inst-001:approved',
      });
    });

    it('parses current-instance form (4 segments) with undefined instance', () => {
      expect(
        parseVnextUrn('urn:vnext:flow:transition:onboarding:kyc-main-flow:approved'),
      ).toEqual({
        kind: 'flow-transition',
        domain: 'onboarding',
        flow: 'kyc-main-flow',
        instance: undefined,
        transition: 'approved',
        raw: 'urn:vnext:flow:transition:onboarding:kyc-main-flow:approved',
      });
    });

    it('rejects malformed transition URNs as unknown', () => {
      expect(parseVnextUrn('urn:vnext:flow:transition:onlydomain')).toMatchObject({
        kind: 'unknown',
      });
    });
  });

  describe('fn — domain scope', () => {
    it('parses default-verb form urn:vnext:fn:<domain>:<fn>', () => {
      expect(parseVnextUrn('urn:vnext:fn:onboarding:custom-function')).toEqual({
        kind: 'fn',
        command: 'get',
        domain: 'onboarding',
        function: 'custom-function',
        raw: 'urn:vnext:fn:onboarding:custom-function',
      });
    });

    it('parses explicit-verb form for every command', () => {
      for (const command of ['get', 'post', 'patch', 'delete'] as const) {
        const urn = `urn:vnext:fn:${command}:onboarding:custom-function`;
        expect(parseVnextUrn(urn)).toEqual({
          kind: 'fn',
          command,
          domain: 'onboarding',
          function: 'custom-function',
          raw: urn,
        });
      }
    });
  });

  describe('fn — workflow + instance scope', () => {
    it('parses default-verb form (4 segments after fn:)', () => {
      expect(
        parseVnextUrn('urn:vnext:fn:onboarding:kyc-main-flow:inst-1:custom-function'),
      ).toEqual({
        kind: 'fn',
        command: 'get',
        domain: 'onboarding',
        flow: 'kyc-main-flow',
        instance: 'inst-1',
        function: 'custom-function',
        raw: 'urn:vnext:fn:onboarding:kyc-main-flow:inst-1:custom-function',
      });
    });

    it('parses explicit-verb workflow form (5 segments after fn:)', () => {
      expect(
        parseVnextUrn('urn:vnext:fn:post:onboarding:kyc-main-flow:inst-1:custom-function'),
      ).toMatchObject({
        kind: 'fn',
        command: 'post',
        domain: 'onboarding',
        flow: 'kyc-main-flow',
        instance: 'inst-1',
        function: 'custom-function',
      });
    });

    it('rejects malformed function URNs (3 segments after fn) as unknown', () => {
      expect(parseVnextUrn('urn:vnext:fn:onboarding:flow:fn')).toMatchObject({ kind: 'unknown' });
    });
  });

  describe('hard cut from urn:amorphie:*', () => {
    it('classifies all legacy amorphie URNs as unknown (no kind reuse)', () => {
      const legacy = [
        'urn:amorphie:wf:loan:transition:approve',
        'urn:amorphie:func:shared:get-cities',
        'urn:amorphie:func:retail:loan:get-customer-tier',
        'urn:amorphie:transition:retail:loan:inst:approve',
        'urn:forge:nav:/accounts',
        'urn:tenant:acme:custom:track',
      ];
      for (const urn of legacy) {
        expect(parseVnextUrn(urn)).toEqual({ kind: 'unknown', raw: urn });
      }
    });
  });

  it('classifies arbitrary unknown URN shapes without dropping the raw value', () => {
    expect(parseVnextUrn('urn:something:else')).toEqual({
      kind: 'unknown',
      raw: 'urn:something:else',
    });
  });

  it('strips whitespace before classification', () => {
    expect(
      parseVnextUrn('   urn:vnext:flow:transition:dom:flow:state   '),
    ).toMatchObject({ kind: 'flow-transition', domain: 'dom', flow: 'flow', transition: 'state' });
  });
});
