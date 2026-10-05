import { describe, expect, it } from 'vitest';

import { fieldProtectionIssues } from './fieldProtection';

const component = (props: Record<string, unknown>, root: Record<string, unknown> = {}) => ({
  attributes: { type: 'schema', schema: { type: 'object', properties: props, ...root } },
});
const at = (name: string) => `/properties/${name}`;

describe('fieldProtectionIssues (runtime 0.0.99 publish rules)', () => {
  it('accepts masking on a string field', () => {
    const json = component({ iban: { type: 'string', 'x-masking': { operator: 'mask' } } });
    expect(fieldProtectionIssues(json, at('iban'), 'x-masking')).toEqual([]);
  });

  it('accepts a nullable string', () => {
    const json = component({ iban: { type: ['string', 'null'], 'x-encryption': { type: 'encrypt' } } });
    expect(fieldProtectionIssues(json, at('iban'), 'x-encryption')).toEqual([]);
  });

  it('rejects a non-string field', () => {
    const json = component({ n: { type: 'number', 'x-masking': { operator: 'mask' } } });
    expect(fieldProtectionIssues(json, at('n'), 'x-masking').join()).toContain('type "string"');
  });

  it('rejects masking next to an active encryption, not next to none', () => {
    const both = component({ s: { type: 'string', 'x-masking': { operator: 'mask' }, 'x-encryption': { type: 'hash' } } });
    expect(fieldProtectionIssues(both, at('s'), 'x-masking').join()).toContain('One transform per field');
    const none = component({ s: { type: 'string', 'x-masking': { operator: 'mask' }, 'x-encryption': { type: 'none' } } });
    expect(fieldProtectionIssues(none, at('s'), 'x-masking')).toEqual([]);
  });

  it('rejects hash with format constraints', () => {
    const json = component({ s: { type: 'string', pattern: '^a', maxLength: 3, 'x-encryption': { type: 'hash' } } });
    expect(fieldProtectionIssues(json, at('s'), 'x-encryption').join()).toContain('pattern, maxLength');
  });

  it('rejects combining with query keywords', () => {
    const json = component({ s: { type: 'string', 'x-sortable': true, 'x-masking': { operator: 'mask' } } });
    expect(fieldProtectionIssues(json, at('s'), 'x-masking').join()).toContain('x-sortable');
  });

  it('rejects fields under items', () => {
    const json = component({
      list: { type: 'array', items: { type: 'object', properties: { s: { type: 'string', 'x-masking': { operator: 'mask' } } } } },
    });
    expect(fieldProtectionIssues(json, '/properties/list/items/properties/s', 'x-masking').join()).toContain('nested properties');
  });

  it('is silent when the keyword is absent', () => {
    expect(fieldProtectionIssues(component({ s: { type: 'number' } }), at('s'), 'x-masking')).toEqual([]);
  });
});
