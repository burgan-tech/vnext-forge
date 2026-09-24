import { describe, expect, it } from 'vitest';

import type { FilterCondition } from './instanceFilterSerializer';
import {
  collectMasterSchemaFields,
  describeSchemaField,
  fieldValueType,
  findSchemaField,
  operatorsForCondition,
  schemaFieldNotice,
  sortableAttributeOptions,
  usesIndexProjection,
} from './masterSchemaFields';

const SCHEMA = {
  type: 'object',
  properties: {
    amount: { type: 'number', 'x-indexed': true, 'x-filterOperators': ['eq', 'gte', 'in', 'neq'], 'x-sortable': true },
    when: { type: 'string', format: 'date-time', 'x-indexed': true, 'x-filterOperators': ['gte'] },
    customer: {
      type: 'object',
      properties: { name: { type: 'string', 'x-filterOperators': ['eq', 'contains', 'startsWith', ' '] } },
    },
    legacy: { type: 'number', 'x-filterOperators': ['ge'] },
    active: { type: 'boolean', 'x-filterOperators': ['eq'] },
    plain: {},
    tags: 'not a schema',
  },
};
const FIELDS = collectMasterSchemaFields(SCHEMA);
const field = (path: string) => findSchemaField(FIELDS, path)!;
const attr = (path: string, valueType: FilterCondition['valueType'] = 'text'): FilterCondition => ({
  category: 'attribute',
  field: path,
  operator: 'eq',
  value: '',
  valueType,
});

describe('collectMasterSchemaFields (runtime SchemaFilterMetadataResolver)', () => {
  it('collects dotted paths of object-valued properties, recursing into nested properties', () => {
    expect(FIELDS.map((f) => f.path)).toEqual(['amount', 'when', 'customer', 'customer.name', 'legacy', 'active', 'plain']);
  });

  it('reads type (default string), format, x-indexed, x-sortable and non-blank x-filterOperators', () => {
    expect(field('amount')).toEqual({
      path: 'amount',
      type: 'number',
      indexed: true,
      filterOperators: ['eq', 'gte', 'in', 'neq'],
      sortable: true,
    });
    expect(field('when').format).toBe('date-time');
    expect(field('customer.name').filterOperators).toEqual(['eq', 'contains', 'startsWith']);
    expect(field('plain')).toEqual({ path: 'plain', type: 'string', indexed: false, filterOperators: [], sortable: false });
  });

  it('returns nothing for non-object schemas', () => {
    expect(collectMasterSchemaFields(null)).toEqual([]);
  });
});

describe('fieldValueType', () => {
  it('maps schema types to value coercion', () => {
    expect(fieldValueType(field('amount'))).toBe('number');
    expect(fieldValueType(field('when'))).toBe('date');
    expect(fieldValueType(field('active'))).toBe('boolean');
    expect(fieldValueType(field('customer.name'))).toBe('text');
  });
});

describe('operatorsForCondition (runtime SchemaFilterContext.IsOperatorAllowed)', () => {
  it('keeps only type operators whose schema spelling is listed', () => {
    expect(operatorsForCondition(attr('amount', 'number'), FIELDS)).toEqual(['eq', 'ne', 'ge', 'in']);
    expect(operatorsForCondition(attr('customer.name'), FIELDS)).toEqual(['eq', 'like', 'match', 'startswith']);
  });

  it('does not honour legacy spellings in the schema (the runtime rejects them too)', () => {
    expect(operatorsForCondition(attr('legacy', 'number'), FIELDS)).toEqual([
      'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'in', 'nin', 'isNull',
    ]);
    expect(schemaFieldNotice(attr('legacy', 'number'), FIELDS)).toContain('runtime spellings');
  });

  it('falls back to the type operators with a notice for undeclared or unfilterable fields', () => {
    expect(operatorsForCondition(attr('ghost'), FIELDS)).toContain('like');
    expect(schemaFieldNotice(attr('ghost'), FIELDS)).toContain('Not declared in the master schema');
    expect(schemaFieldNotice(attr('plain'), FIELDS)).toContain('no x-filterOperators');
  });

  it('is unchanged without a schema and for instance fields', () => {
    expect(schemaFieldNotice(attr('ghost'), undefined)).toBeNull();
    const status: FilterCondition = { category: 'instance', field: 'status', operator: 'eq', value: '' };
    expect(operatorsForCondition(status, FIELDS)).toEqual(['eq', 'ne', 'in', 'nin']);
    expect(schemaFieldNotice(status, FIELDS)).toBeNull();
    expect(schemaFieldNotice(attr('amount', 'number'), FIELDS)).toBeNull();
  });
});

describe('usesIndexProjection (runtime AttributeConditionBuilder)', () => {
  it('is true for text/membership/isNull operators regardless of field type (text column always present when indexed)', () => {
    for (const op of ['like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull'] as const) {
      expect(usesIndexProjection(op, field('amount'))).toBe(true);
      expect(usesIndexProjection(op, field('active'))).toBe(true);
    }
  });

  it('is false for eq/ne/includes (JSON containment only, no projection) regardless of field', () => {
    for (const op of ['eq', 'ne', 'includes'] as const) {
      expect(usesIndexProjection(op, field('amount'))).toBe(false);
      expect(usesIndexProjection(op)).toBe(false);
    }
  });

  it('is true for comparisons on a numeric field (numeric column present)', () => {
    for (const op of ['gt', 'ge', 'lt', 'le', 'between'] as const) {
      expect(usesIndexProjection(op, field('amount'))).toBe(true);
    }
  });

  it('is true for comparisons on a date-time string field (timestamptz column present)', () => {
    for (const op of ['gt', 'ge', 'lt', 'le', 'between'] as const) {
      expect(usesIndexProjection(op, field('when'))).toBe(true);
    }
  });

  it('is false for comparisons on a boolean field (neither numeric nor timestamptz column exists)', () => {
    for (const op of ['gt', 'ge', 'lt', 'le', 'between'] as const) {
      expect(usesIndexProjection(op, field('active'))).toBe(false);
    }
  });

  it('is false for comparisons on a plain (non-date-time) string field', () => {
    expect(usesIndexProjection('gt', field('customer.name'))).toBe(false);
  });

  it('without a field, assumes comparisons are index-backed (legacy callers)', () => {
    for (const op of ['gt', 'ge', 'lt', 'le', 'between'] as const) {
      expect(usesIndexProjection(op)).toBe(true);
    }
  });
});

describe('sortableAttributeOptions and describeSchemaField', () => {
  it('offers attributes.<path> for x-sortable fields', () => {
    expect(sortableAttributeOptions(FIELDS)).toEqual([{ value: 'attributes.amount', label: 'amount', indexed: true }]);
    expect(sortableAttributeOptions(undefined)).toEqual([]);
  });

  it('describes type, index and filterability', () => {
    expect(describeSchemaField(field('amount'))).toBe('number · IDX');
    expect(describeSchemaField(field('plain'))).toBe('string · not filterable');
  });
});
