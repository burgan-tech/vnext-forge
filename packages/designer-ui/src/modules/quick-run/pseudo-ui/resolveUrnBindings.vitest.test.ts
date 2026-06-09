import { describe, expect, it } from 'vitest';

import { resolveUrnBindings } from './resolveUrnBindings';

describe('resolveUrnBindings (R26)', () => {
  it('returns input untouched when no placeholders are present', () => {
    const result = resolveUrnBindings('urn:vnext:flow:start:dom:flow', {
      data: { id: '1' },
      extensions: null,
    });
    expect(result.resolved).toBe('urn:vnext:flow:start:dom:flow');
    expect(result.unresolved).toEqual([]);
  });

  it('resolves a flat path from instance data', () => {
    const result = resolveUrnBindings(
      'urn:vnext:flow:transition:dom:flow:${customerId}:approved',
      { data: { customerId: 'C-9' }, extensions: null },
    );
    expect(result.resolved).toBe('urn:vnext:flow:transition:dom:flow:C-9:approved');
    expect(result.unresolved).toEqual([]);
  });

  it('resolves a dotted path through nested data', () => {
    const result = resolveUrnBindings(
      'urn:vnext:fn:get:dom:flow:${customer.ownerUserId}:get-cust',
      { data: { customer: { ownerUserId: 'U-1234' } }, extensions: null },
    );
    expect(result.resolved).toBe('urn:vnext:fn:get:dom:flow:U-1234:get-cust');
    expect(result.unresolved).toEqual([]);
  });

  it('falls back to extensions when path misses in data', () => {
    const result = resolveUrnBindings(
      'urn:vnext:flow:transition:dom:flow:${session.id}:approved',
      {
        data: { customer: { id: '1' } },
        extensions: { session: { id: 'S-2' } },
      },
    );
    expect(result.resolved).toBe('urn:vnext:flow:transition:dom:flow:S-2:approved');
    expect(result.unresolved).toEqual([]);
  });

  it('falls back to formData last', () => {
    const result = resolveUrnBindings(
      'urn:vnext:fn:onboarding:${draftId}',
      {
        data: null,
        extensions: null,
        formData: { draftId: 'D-77' },
      },
    );
    expect(result.resolved).toBe('urn:vnext:fn:onboarding:D-77');
    expect(result.unresolved).toEqual([]);
  });

  it('reports unresolved placeholders and leaves them intact', () => {
    const result = resolveUrnBindings(
      'urn:vnext:flow:transition:dom:flow:${missing.key}:approved',
      { data: { other: 'x' }, extensions: null },
    );
    expect(result.resolved).toBe('urn:vnext:flow:transition:dom:flow:${missing.key}:approved');
    expect(result.unresolved).toEqual(['missing.key']);
  });

  it('coerces non-string values via render rules', () => {
    const result = resolveUrnBindings(
      'urn:vnext:fn:get:dom:fn?n=${count}&flag=${enabled}&meta=${meta}',
      {
        data: { count: 3, enabled: true, meta: { k: 'v' } },
        extensions: null,
      },
    );
    expect(result.resolved).toBe('urn:vnext:fn:get:dom:fn?n=3&flag=true&meta={"k":"v"}');
  });

  it('treats explicit null as resolved-empty', () => {
    const result = resolveUrnBindings('urn:vnext:fn:get:dom:fn?id=${value}', {
      data: { value: null },
      extensions: null,
    });
    expect(result.resolved).toBe('urn:vnext:fn:get:dom:fn?id=');
    expect(result.unresolved).toEqual([]);
  });

  it('handles multiple placeholders independently', () => {
    const result = resolveUrnBindings(
      'urn:vnext:fn:get:${dom}:${flow}:${id}:${fn}',
      {
        data: { dom: 'onboarding', flow: 'kyc-main', id: 'inst-1', fn: 'cust' },
        extensions: null,
      },
    );
    expect(result.resolved).toBe('urn:vnext:fn:get:onboarding:kyc-main:inst-1:cust');
  });
});
