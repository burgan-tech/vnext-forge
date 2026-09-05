import { describe, expect, it } from 'vitest';

import {
  getOperatorsForFieldType,
  isValidAttributePath,
  serializeCondition,
  serializeInstanceFilter,
  serializeInstanceSort,
  type FilterCondition,
} from './instanceFilterSerializer';

const inst = (field: string, operator: FilterCondition['operator'], value = '', value2?: string): FilterCondition =>
  ({ category: 'instance', field, operator, value, value2 });
const attr = (
  field: string,
  operator: FilterCondition['operator'],
  value = '',
  valueType?: FilterCondition['valueType'],
  value2?: string,
): FilterCondition => ({ category: 'attribute', field, operator, value, value2, valueType });

const parse = (c: FilterCondition) => {
  const r = serializeCondition(c);
  expect(r.error).toBeUndefined();
  return r.node;
};

describe('isValidAttributePath', () => {
  it.each(['amount', 'customer.id', 'a_1.B2'])('accepts %s', (p) => expect(isValidAttributePath(p)).toBe(true));
  it.each(['', 'a-b', 'a b', 'a..b', 'a.', 'a[0]', 'a$'])('rejects %j', (p) => expect(isValidAttributePath(p)).toBe(false));
});

describe('serializeCondition — wire shapes', () => {
  it('in / nin become arrays (the old string form is a 400 now)', () => {
    expect(parse(inst('status', 'in', 'Active, Faulted'))).toEqual({ status: { in: ['Active', 'Faulted'] } });
    expect(parse(inst('status', 'nin', 'Completed'))).toEqual({ status: { nin: ['Completed'] } });
  });

  it('in on a numeric attribute coerces each element', () => {
    expect(parse(attr('amount', 'in', '1, 2,3', 'number'))).toEqual({ attributes: { amount: { in: [1, 2, 3] } } });
  });

  it('between becomes a two-element array from value + value2', () => {
    expect(parse(attr('amount', 'between', '10', 'number', '20'))).toEqual({ attributes: { amount: { between: [10, 20] } } });
  });

  it('between with a missing upper bound is an error', () => {
    expect(serializeCondition(attr('amount', 'between', '10', 'number')).error).toMatch(/Upper bound/);
  });

  it('isNull is a boolean and needs no value', () => {
    expect(parse(inst('completedAt', 'isNull'))).toEqual({ completedAt: { isNull: true } });
  });

  it('date fields go out as ISO-8601 UTC', () => {
    const node = parse(inst('createdAt', 'ge', '2026-01-01T10:00')) as { createdAt: { ge: string } };
    expect(node.createdAt.ge).toBe(new Date('2026-01-01T10:00').toISOString());
    expect(node.createdAt.ge.endsWith('Z')).toBe(true);
  });

  it('rejects an unparseable date', () => {
    expect(serializeCondition(inst('createdAt', 'gt', 'yesterday')).error).toMatch(/not a valid date/);
  });

  it('numeric attributes become JSON numbers; non-numbers are errors', () => {
    expect(parse(attr('amount', 'gt', '500', 'number'))).toEqual({ attributes: { amount: { gt: 500 } } });
    expect(serializeCondition(attr('amount', 'gt', 'abc', 'number')).error).toMatch(/not a number/);
  });

  it('boolean attributes become JSON booleans', () => {
    expect(parse(attr('vip', 'eq', 'true', 'boolean'))).toEqual({ attributes: { vip: { eq: true } } });
    expect(serializeCondition(attr('vip', 'eq', 'yes', 'boolean')).error).toMatch(/true or false/);
  });

  it('text attributes stay strings and are trimmed', () => {
    expect(parse(attr('name', 'like', '  ali '))).toEqual({ attributes: { name: { like: 'ali' } } });
  });

  it('dotted attribute paths nest into objects (the shape the runtime converter walks)', () => {
    expect(parse(attr('customer.id', 'eq', '42'))).toEqual({ attributes: { customer: { id: { eq: '42' } } } });
    expect(parse(attr('a.b.c', 'gt', '1', 'number'))).toEqual({ attributes: { a: { b: { c: { gt: 1 } } } } });
  });

  it('includes requires a JSON object and only applies to attributes', () => {
    expect(parse(attr('roles', 'includes', '{"role":"admin"}'))).toEqual({ attributes: { roles: { includes: { role: 'admin' } } } });
    expect(serializeCondition(attr('roles', 'includes', '["admin"]')).error).toMatch(/JSON object/);
    expect(serializeCondition(attr('roles', 'includes', 'not json')).error).toMatch(/JSON object/);
    expect(serializeCondition(inst('status', 'includes', '{}')).error).toMatch(/only applies to attributes/);
  });

  it('rejects an unsafe attribute path before touching the value', () => {
    expect(serializeCondition(attr('a-b', 'eq', 'x')).error).toMatch(/letters, digits and underscores/);
  });

  it('rejects an empty field', () => {
    expect(serializeCondition(attr('', 'eq', 'x')).error).toMatch(/Field is required/);
  });
});

describe('serializeInstanceFilter', () => {
  it('returns no filter for no conditions', () => {
    expect(serializeInstanceFilter([])).toEqual({ errors: {} });
  });

  it('skips untouched rows, flattens a single condition', () => {
    const r = serializeInstanceFilter([inst('status', 'eq', 'Active'), inst('key', 'like', '')]);
    expect(r.errors).toEqual({});
    expect(JSON.parse(r.filter!)).toEqual({ status: { eq: 'Active' } });
  });

  it('wraps several conditions in and[]', () => {
    const r = serializeInstanceFilter([inst('status', 'in', 'Active,Busy'), attr('amount', 'gt', '5', 'number')]);
    expect(JSON.parse(r.filter!)).toEqual({ and: [{ status: { in: ['Active', 'Busy'] } }, { attributes: { amount: { gt: 5 } } }] });
  });

  it('reports errors by row index and produces no filter', () => {
    const r = serializeInstanceFilter([inst('status', 'eq', 'Active'), attr('a-b', 'eq', 'x'), attr('n', 'gt', 'x', 'number')]);
    expect(r.filter).toBeUndefined();
    expect(Object.keys(r.errors)).toEqual(['1', '2']);
  });

  it('treats a between row with only the upper bound as filled (so it errors instead of vanishing)', () => {
    const r = serializeInstanceFilter([attr('amount', 'between', '', 'number', '20')]);
    expect(r.errors[0]).toMatch(/Lower bound/);
  });
});

describe('operators per type', () => {
  it('boolean attributes only get equality and null checks', () => {
    expect(getOperatorsForFieldType('attribute', 'boolean')).toEqual(['eq', 'ne', 'isNull']);
  });
  it('text attributes get includes; instance strings do not', () => {
    expect(getOperatorsForFieldType('attribute', 'text')).toContain('includes');
    expect(getOperatorsForFieldType('string')).not.toContain('includes');
    expect(getOperatorsForFieldType('string')).toContain('match');
  });
});

describe('serializeInstanceSort', () => {
  it('emits the JSON sort the runtime requires (no -field shorthand)', () => {
    expect(JSON.parse(serializeInstanceSort('createdAt', 'desc'))).toEqual({ field: 'createdAt', direction: 'desc' });
  });
});
