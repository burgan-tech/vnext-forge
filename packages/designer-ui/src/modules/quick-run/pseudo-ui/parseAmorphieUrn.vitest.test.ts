import { describe, expect, it } from 'vitest';

import { parseAmorphieUrn } from './parseAmorphieUrn';

describe('parseAmorphieUrn (R25)', () => {
  it('returns null for empty / non-string input', () => {
    expect(parseAmorphieUrn(undefined)).toBeNull();
    expect(parseAmorphieUrn(null)).toBeNull();
    expect(parseAmorphieUrn('')).toBeNull();
    expect(parseAmorphieUrn('   ')).toBeNull();
    expect(parseAmorphieUrn(42 as unknown as string)).toBeNull();
  });

  it('classifies raw transition keys', () => {
    expect(parseAmorphieUrn('approve')).toEqual({ kind: 'raw', value: 'approve' });
    expect(parseAmorphieUrn('  my-transition  ')).toEqual({ kind: 'raw', value: 'my-transition' });
  });

  it('parses canonical workflow transition URN (urn:amorphie:wf:<flow>:transition:<state>)', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:wf:loan-flow:transition:approve'),
    ).toEqual({
      kind: 'wf-transition',
      flow: 'loan-flow',
      state: 'approve',
      raw: 'urn:amorphie:wf:loan-flow:transition:approve',
    });
  });

  it('parses workflow URN even when state contains colons', () => {
    const result = parseAmorphieUrn('urn:amorphie:wf:loan:transition:step:nested');
    expect(result).toMatchObject({ kind: 'wf-transition', flow: 'loan', state: 'step:nested' });
  });

  it('classifies malformed workflow URN as unknown', () => {
    expect(parseAmorphieUrn('urn:amorphie:wf:onlyflow')).toEqual({
      kind: 'unknown',
      raw: 'urn:amorphie:wf:onlyflow',
    });
    expect(parseAmorphieUrn('urn:amorphie:wf:flow:notransition:x')).toEqual({
      kind: 'unknown',
      raw: 'urn:amorphie:wf:flow:notransition:x',
    });
  });

  it('parses domain-scoped function URN (urn:amorphie:func:<domain>:<function>)', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:func:shared:get-cities'),
    ).toEqual({
      kind: 'func',
      scope: 'domain',
      domain: 'shared',
      function: 'get-cities',
      raw: 'urn:amorphie:func:shared:get-cities',
    });
  });

  it('parses workflow-scoped function URN (urn:amorphie:func:<domain>:<workflow>:<function>)', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:func:retail:loan-onboarding:get-customer-tier'),
    ).toEqual({
      kind: 'func',
      scope: 'workflow',
      domain: 'retail',
      workflow: 'loan-onboarding',
      function: 'get-customer-tier',
      raw: 'urn:amorphie:func:retail:loan-onboarding:get-customer-tier',
    });
  });

  it('rejects function URNs with more than 3 trailing segments as unknown', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:func:shared:wf:nested:fn'),
    ).toMatchObject({ kind: 'unknown' });
  });

  it('parses legacy 7-segment transition URN (R24 back-compat)', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:transition:retail:loan:inst-001:approve'),
    ).toEqual({
      kind: 'legacy-transition',
      domain: 'retail',
      workflow: 'loan',
      instance: 'inst-001',
      state: 'approve',
      raw: 'urn:amorphie:transition:retail:loan:inst-001:approve',
    });
  });

  it('parses legacy 6-segment transition URN (no instance scope)', () => {
    expect(
      parseAmorphieUrn('urn:amorphie:transition:retail:loan:approve'),
    ).toEqual({
      kind: 'legacy-transition',
      domain: 'retail',
      workflow: 'loan',
      instance: '',
      state: 'approve',
      raw: 'urn:amorphie:transition:retail:loan:approve',
    });
  });

  it('parses navigation URN (urn:forge:nav:<route>)', () => {
    expect(parseAmorphieUrn('urn:forge:nav:/accounts/:id')).toEqual({
      kind: 'nav',
      route: '/accounts/:id',
      raw: 'urn:forge:nav:/accounts/:id',
    });
  });

  it('parses tenant URN (urn:tenant:<tenant>:<path>)', () => {
    expect(parseAmorphieUrn('urn:tenant:acme:custom:track-button')).toEqual({
      kind: 'tenant',
      tenant: 'acme',
      path: 'custom:track-button',
      raw: 'urn:tenant:acme:custom:track-button',
    });
  });

  it('classifies unknown URN shapes without dropping the raw value', () => {
    expect(parseAmorphieUrn('urn:something:else')).toEqual({
      kind: 'unknown',
      raw: 'urn:something:else',
    });
  });

  it('strips whitespace before classification', () => {
    expect(
      parseAmorphieUrn('   urn:amorphie:wf:flow:transition:state   '),
    ).toMatchObject({ kind: 'wf-transition', flow: 'flow', state: 'state' });
  });
});
