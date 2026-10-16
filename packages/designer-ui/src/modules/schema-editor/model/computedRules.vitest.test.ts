import { describe, expect, it } from 'vitest';

import { computedIssues, computedSiblings } from './computedRules';

const doc = (props: Record<string, unknown>, required: string[] = []) => ({
  attributes: { type: 'master', schema: { type: 'object', properties: { customer: { type: 'object', required, properties: props } } } },
});
const at = '/properties/customer/properties/displayName';
const base = {
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  customerType: { type: 'string' },
};
const displayName = (computed: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: 'string',
  'x-computed': computed,
  ...extra,
});

describe('computedIssues (runtime publish rules)', () => {
  it('accepts the documented example', () => {
    const json = doc({
      ...base,
      displayName: displayName({
        evaluatedBy: 'runtime',
        cases: [{ when: { field: 'customerType', operator: 'equals', value: 'corporate' }, join: { fields: ['firstName'] } }],
        fallback: { join: { fields: ['firstName', 'lastName'], separator: ' ' } },
        whenAbsent: 'empty',
      }),
    });
    expect(computedIssues(json, at)).toEqual([]);
    expect(computedSiblings(json, at)).toEqual(['firstName', 'lastName', 'customerType']);
  });

  it("rejects 'server' as renamed and skips checks for client", () => {
    expect(computedIssues(doc({ ...base, displayName: displayName({ evaluatedBy: 'server' }) }), at)[0]).toContain('renamed');
    expect(computedIssues(doc({ ...base, displayName: displayName({ evaluatedBy: 'client' }) }), at)).toEqual([]);
  });

  it('flags required, stored-only keywords and a missing operation', () => {
    const issues = computedIssues(
      doc({ ...base, displayName: displayName({ evaluatedBy: 'runtime' }, { 'x-sortable': true }) }, ['displayName']),
      at,
    );
    expect(issues.some((i) => i.includes("cannot be 'required'"))).toBe(true);
    expect(issues.some((i) => i.includes('x-sortable'))).toBe(true);
    expect(issues.some((i) => i.includes("needs 'cases' or a 'fallback'"))).toBe(true);
  });

  it('checks operations, siblings, chaining and encryption', () => {
    const issues = computedIssues(
      doc({
        ...base,
        secret: { type: 'string', 'x-encryption': { type: 'encrypt' } },
        other: displayName({ evaluatedBy: 'runtime', fallback: { join: { fields: ['firstName'] } } }),
        displayName: displayName({
          evaluatedBy: 'runtime',
          cases: [{ join: { fields: ['x'] }, arithmetic: { op: 'add', fields: ['a', 'b'] } }],
          fallback: { arithmetic: { op: 'mod', fields: ['other', 'secret', 'missing'] } },
        }),
      }),
      at,
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        "x-computed.cases[0] must declare exactly one of 'join' or 'arithmetic'.",
        "x-computed.fallback.arithmetic.op must be 'add', 'subtract', 'multiply' or 'divide'.",
        "x-computed.fallback.arithmetic references 'other', which is itself a runtime computed field; computed fields do not chain.",
        "x-computed.fallback.arithmetic references 'secret', which is encrypted at rest.",
        "x-computed.fallback.arithmetic references 'missing', which is not a property of the same object.",
      ]),
    );
  });

  it('refuses placement under items', () => {
    const json = { attributes: { schema: { type: 'object', properties: { list: { type: 'array', items: displayName({ evaluatedBy: 'runtime', fallback: { join: { fields: ['a'] } } }) } } } } };
    expect(computedIssues(json, '/properties/list/items').some((i) => i.includes('nested'))).toBe(true);
  });
});
