import { describe, expect, it } from 'vitest';

import {
  INDEX_MESSAGES,
  analyzeIndexEligibility,
  findIndexViolations,
  getIndexAnalysis,
  indexColumnsFor,
  indexInfoAt,
  indexTypeMismatch,
  indexedPointers,
} from './indexEligibility';

type Schema = Record<string, unknown>;

const indexedField: Schema = { type: 'number', 'x-indexed': true };
const withField = (field: Schema): Schema => ({ type: 'object', properties: { amount: field } });
// A plain default parameter (`type: unknown = 'master'`) would coerce an
// explicitly-passed `undefined` (the last case in the `attributes.type`
// it.each below) back to 'master', silently defeating that case. The rest
// tuple distinguishes "omitted" (defaults to 'master') from "explicitly
// undefined" (reaches analyzeIndexEligibility as undefined, i.e. not master).
const reasons = (schema: Schema, ...typeArg: [unknown] | []): string[] => {
  const type = typeArg.length > 0 ? typeArg[0] : 'master';
  return findIndexViolations(analyzeIndexEligibility(schema, type)).map((v) => v.reason);
};

describe('index eligibility — explicit scalar fields', () => {
  it.each(['string', 'number', 'integer', 'boolean'])('accepts scalar %s', (type) => {
    expect(reasons(withField({ type, 'x-indexed': true }))).toEqual([]);
  });

  it('accepts date-time strings', () => {
    expect(reasons(withField({ type: 'string', format: 'date-time', 'x-indexed': true }))).toEqual([]);
  });

  it.each([['true'], [1], [null], [{}], [[]]])('rejects non-boolean metadata %j', (indexed) => {
    expect(reasons(withField({ type: 'number', 'x-indexed': indexed }))).toEqual(['notBoolean']);
  });

  it.each([['object'], ['array'], ['null'], [['number', 'null']], [undefined]])(
    'requires an explicit scalar type (%j), but false never requests a projection',
    (type) => {
      const typed = type === undefined ? {} : { type };
      expect(reasons(withField({ ...typed, 'x-indexed': true }))).toEqual(['notScalar']);
      expect(reasons(withField({ ...typed, 'x-indexed': false }))).toEqual([]);
    },
  );

  it('rejects the document root', () => {
    expect(reasons({ type: 'number', 'x-indexed': true })).toEqual(['root']);
  });
});

describe('index eligibility — paths', () => {
  it('accepts implicit objects and a numeric nested key', () => {
    expect(reasons({ properties: { nested: { properties: { '0': indexedField } } } })).toEqual([]);
  });

  it.each(['a.b', 'a-b', 'İsim', ''])('rejects the property name %j at the root and nested', (name) => {
    expect(reasons({ properties: { [name]: indexedField } })).toEqual(['invalidPath']);
    expect(reasons({ properties: { nested: { properties: { [name]: indexedField } } } })).toEqual(['invalidPath']);
  });

  it.each(['0', '_amount'])('requires the first segment %j to start with a letter', (name) => {
    expect(reasons({ properties: { [name]: indexedField } })).toEqual(['invalidPath']);
  });

  it.each([['array'], ['string'], [['object', 'null']]])('rejects a parent of type %j', (type) => {
    expect(reasons({ properties: { nested: { type, properties: { amount: indexedField } } } })).toEqual([
      'parentNotObject',
    ]);
  });

  it('reports the dotted runtime path', () => {
    const analysis = analyzeIndexEligibility(
      { type: 'object', properties: { customer: { type: 'object', properties: { name: { type: 'string' } } } } },
      'master',
    );
    expect(analysis.get('/properties/customer/properties/name')).toEqual({
      pointer: '/properties/customer/properties/name',
      path: 'customer.name',
      eligible: true,
      indexed: undefined,
    });
  });
});

describe('index eligibility — references and conditional schemas', () => {
  const conditions: Record<string, unknown> = {
    $ref: '#/$defs/amount',
    allOf: [],
    anyOf: [],
    oneOf: [],
    not: {},
    if: {},
    then: {},
    else: {},
    dependentSchemas: {},
  };

  it.each(Object.entries(conditions))('%s on the indexed node, an ancestor, or a sibling', (keyword, value) => {
    expect(reasons(withField({ ...indexedField, [keyword]: value }))).toEqual(['composition']);
    expect(reasons({ [keyword]: value, properties: { amount: indexedField } })).toEqual(['composition']);
    expect(reasons({ properties: { amount: indexedField, sibling: { [keyword]: value } } })).toEqual([]);
  });

  it('allows conditional unindexed fields beside indexed fields', () => {
    expect(
      reasons({ properties: { amount: indexedField, other: { type: 'string', oneOf: [{ maxLength: 10 }] } } }),
    ).toEqual([]);
  });
});

describe('index eligibility — dynamic schema locations', () => {
  it.each(['items', 'additionalProperties', 'contains', 'propertyNames', 'additionalItems', 'unevaluatedProperties', 'unevaluatedItems'])(
    'rejects %s',
    (keyword) => {
      expect(reasons({ [keyword]: withField(indexedField) })).toEqual(['dynamicLocation']);
      expect(reasons({ [keyword]: withField({ type: 'number', 'x-indexed': false }) })).toEqual([]);
    },
  );

  it.each(['$defs', 'definitions', 'patternProperties'])('rejects dictionary %s', (keyword) => {
    expect(reasons({ [keyword]: { entry: withField(indexedField) } })).toEqual(['dynamicLocation']);
  });

  it('rejects dependentSchemas entries (the keyword also makes the node conditional)', () => {
    expect(reasons({ dependentSchemas: { entry: withField(indexedField) } })).toEqual(['composition']);
  });

  it.each(['prefixItems', 'items'])('rejects array %s', (keyword) => {
    expect(reasons({ [keyword]: [withField(indexedField)] })).toEqual(['dynamicLocation']);
  });

  it.each(['allOf', 'anyOf', 'oneOf'])('rejects array %s', (keyword) => {
    expect(reasons({ [keyword]: [withField(indexedField)] })).toEqual(['composition']);
  });

  it('rejects fields under array items (runtime AttributeIndexTests)', () => {
    expect(
      reasons({ properties: { a: { type: 'array', items: { properties: { b: { type: 'number', 'x-indexed': true } } } } } }),
    ).toEqual(['dynamicLocation']);
  });

  it.each(['examples', 'default', 'const', 'enum'])('does not interpret literal %s data', (keyword) => {
    expect(reasons({ ...withField(indexedField), [keyword]: [{ 'x-indexed': 'data, not metadata' }] })).toEqual([]);
  });

  it('accepts a property named x-indexed', () => {
    expect(reasons({ properties: { 'x-indexed': { type: 'string' } } })).toEqual([]);
  });
});

describe('index eligibility — attributes.type', () => {
  it.each(['transition', 'view', 'function', 'workflow', 'custom-schema', 'MASTER', null, '', '   ', undefined])(
    'rejects x-indexed true and false when the type is %j',
    (type) => {
      expect(reasons(withField({ type: 'number', 'x-indexed': true }), type)).toEqual(['notMaster']);
      expect(reasons(withField({ type: 'number', 'x-indexed': false }), type)).toEqual(['notMaster']);
    },
  );

  it('rejects nested false metadata outside master but ignores example data', () => {
    expect(
      reasons({ properties: { nested: { properties: { value: { type: 'string', 'x-indexed': false } } } } }, 'view'),
    ).toEqual(['notMaster']);
    expect(reasons({ type: 'object', examples: [{ 'x-indexed': true }] }, 'view')).toEqual([]);
  });

  it('marks every node ineligible outside master', () => {
    expect(analyzeIndexEligibility(withField({ type: 'number' }), 'view').get('/properties/amount')?.reason).toBe(
      'notMaster',
    );
  });
});

describe('violation messages', () => {
  it('carries the pointer, path and a readable message', () => {
    expect(findIndexViolations(analyzeIndexEligibility(withField({ type: 'array', 'x-indexed': true }), 'master'))).toEqual([
      { pointer: '/properties/amount', path: 'amount', reason: 'notScalar', message: INDEX_MESSAGES.notScalar },
    ]);
  });
});

describe('indexInfoAt', () => {
  it('falls back to an ineligible dynamic location for pointers that were not visited', () => {
    const info = indexInfoAt(new Map(), '/properties/ghost');
    expect(info.eligible).toBe(false);
    expect(info.reason).toBe('dynamicLocation');
  });
});

describe('indexColumnsFor (runtime AttributeIndexDefinition.From)', () => {
  it('always keeps text; adds numeric for numbers and timestamptz for date-time strings', () => {
    expect(indexColumnsFor({ type: 'number' })).toEqual(['text', 'numeric']);
    expect(indexColumnsFor({ type: 'integer' })).toEqual(['text', 'numeric']);
    expect(indexColumnsFor({ type: 'string', format: 'date-time' })).toEqual(['text', 'timestamptz']);
    expect(indexColumnsFor({ type: 'boolean' })).toEqual(['text']);
    expect(indexColumnsFor(null)).toEqual([]);
  });
});

describe('document-level helpers', () => {
  const doc = (type: string, schema: Schema): Record<string, unknown> => ({ key: 'k', attributes: { type, schema } });

  it('caches the analysis per document object', () => {
    const json = doc('master', withField(indexedField));
    expect(getIndexAnalysis(json)).toBe(getIndexAnalysis(json));
    expect(getIndexAnalysis(json).get('/properties/amount')?.eligible).toBe(true);
    expect(getIndexAnalysis(null).size).toBe(0);
  });

  it('lists every node that carries x-indexed', () => {
    const json = doc('master', { properties: { a: indexedField, b: { type: 'string', 'x-indexed': false }, c: {} } });
    expect(indexedPointers(getIndexAnalysis(json))).toEqual(['/properties/a', '/properties/b']);
  });

  it('reports a non-master schema with x-indexed fields', () => {
    expect(indexTypeMismatch(doc('view', withField(indexedField)))).toEqual({
      schemaType: 'view',
      indexedPointers: ['/properties/amount'],
    });
    expect(indexTypeMismatch(doc('master', withField(indexedField)))).toBeNull();
    expect(indexTypeMismatch(doc('view', withField({ type: 'number' })))).toBeNull();
  });
});
