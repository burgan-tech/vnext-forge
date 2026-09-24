import { describe, expect, it } from 'vitest';

import { INDEX_MESSAGES } from './indexEligibility';
import { translateIndexValidationErrors } from './indexValidationMessages';

const doc = (type: string, schema: Record<string, unknown>): Record<string, unknown> => ({
  key: 'k',
  version: '1.0.0',
  domain: 'd',
  flow: 'sys-schemas',
  flowVersion: '1.0.0',
  tags: ['t'],
  attributes: { type, schema },
});

const ARRAY_INDEXED_ERRORS = [
  { path: '/attributes/schema', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/tags', message: 'must be boolean', params: { type: 'boolean' } },
  {
    path: '/attributes/schema/properties/tags/type',
    message: 'must be equal to one of the allowed values',
    params: { allowedValues: ['string', 'number', 'integer', 'boolean'] },
  },
  { path: '/attributes/schema/properties/tags', message: 'must match "then" schema', params: { failingKeyword: 'then' } },
  { path: '/attributes/schema/properties/tags', message: 'must match a schema in anyOf', params: {} },
  { path: '/attributes/schema', message: 'must match a schema in anyOf', params: {} },
  { path: '', message: 'must match "then" schema', params: { failingKeyword: 'then' } },
];

const NON_MASTER_ERRORS = [
  { path: '/attributes/schema', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/amount', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/amount', message: 'must NOT be valid', params: {} },
  { path: '/attributes/schema/properties/amount', message: 'must match a schema in anyOf', params: {} },
  { path: '/attributes/schema', message: 'must match a schema in anyOf', params: {} },
  { path: '', message: 'must match "else" schema', params: { failingKeyword: 'else' } },
];

describe('translateIndexValidationErrors', () => {
  it('replaces the AJV if/then noise with one readable message per field', () => {
    const json = doc('master', { type: 'object', properties: { tags: { type: 'array', 'x-indexed': true } } });
    expect(translateIndexValidationErrors(json, ARRAY_INDEXED_ERRORS)).toEqual([
      { path: '/attributes/schema/properties/tags', message: INDEX_MESSAGES.notScalar },
    ]);
  });

  it('explains x-indexed on a non-master schema', () => {
    const json = doc('view', { type: 'object', properties: { amount: { type: 'number', 'x-indexed': true } } });
    expect(translateIndexValidationErrors(json, NON_MASTER_ERRORS)).toEqual([
      { path: '/attributes/schema/properties/amount', message: INDEX_MESSAGES.notMaster },
    ]);
  });

  it('keeps errors that are not about the schema body', () => {
    const json = doc('view', { type: 'object', properties: { amount: { type: 'number', 'x-indexed': true } } });
    const unrelated = [
      { path: '/key', message: 'must NOT have fewer than 1 characters', params: { limit: 1 } },
      { path: '', message: 'must have required property "tags"', params: { missingProperty: 'tags' } },
    ];
    expect(translateIndexValidationErrors(json, [...NON_MASTER_ERRORS, ...unrelated])).toEqual([
      { path: '/attributes/schema/properties/amount', message: INDEX_MESSAGES.notMaster },
      ...unrelated,
    ]);
  });

  it('returns the AJV errors unchanged when Forge finds no index problem', () => {
    const errors = [{ path: '/attributes/schema', message: 'must NOT have fewer than 1 properties', params: { limit: 1 } }];
    expect(translateIndexValidationErrors(doc('master', {}), errors)).toEqual(errors);
  });
});
