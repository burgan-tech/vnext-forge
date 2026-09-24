import { describe, expect, it } from 'vitest';

import { FILTER_OPERATORS, mergeOperators, normalizeOperator, splitOperators } from './filterOperators';

describe('FILTER_OPERATORS', () => {
  it('lists exactly the runtime spellings', () => {
    expect(FILTER_OPERATORS.map((o) => o.value)).toEqual([
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between',
      'contains', 'startsWith', 'endsWith', 'in', 'nin', 'includes', 'isNull',
    ]);
  });
});

describe('normalizeOperator', () => {
  it('keeps runtime spellings and matches them case-insensitively', () => {
    expect(normalizeOperator('gte')).toBe('gte');
    expect(normalizeOperator('GTE')).toBe('gte');
    expect(normalizeOperator('startswith')).toBe('startsWith');
    expect(normalizeOperator('isnull')).toBe('isNull');
  });

  it('maps legacy spellings', () => {
    expect(normalizeOperator('ge')).toBe('gte');
    expect(normalizeOperator('le')).toBe('lte');
    expect(normalizeOperator('ne')).toBe('neq');
    expect(normalizeOperator('like')).toBe('contains');
    expect(normalizeOperator('match')).toBe('contains');
    expect(normalizeOperator('endswith')).toBe('endsWith');
  });

  it('returns null for unknown values', () => {
    expect(normalizeOperator('regex')).toBeNull();
  });
});

describe('splitOperators', () => {
  it('treats runtime spellings as known, in authored order', () => {
    expect(splitOperators(['contains', 'eq', 'gte'])).toEqual({
      known: ['contains', 'eq', 'gte'],
      unknown: [],
      legacy: [],
    });
  });

  it('normalizes legacy spellings and reports each one', () => {
    expect(splitOperators(['ge', 'like', 'match', 'eq'])).toEqual({
      known: ['gte', 'contains', 'eq'],
      unknown: [],
      legacy: [
        { raw: 'ge', normalized: 'gte' },
        { raw: 'like', normalized: 'contains' },
        { raw: 'match', normalized: 'contains' },
      ],
    });
  });

  it('keeps unknown values verbatim, once, and ignores non-strings', () => {
    expect(splitOperators(['eq', 'regex', 3, 'regex'])).toEqual({ known: ['eq'], unknown: ['regex'], legacy: [] });
  });

  it('returns empty lists for non-arrays', () => {
    expect(splitOperators(undefined)).toEqual({ known: [], unknown: [], legacy: [] });
  });
});

describe('mergeOperators', () => {
  it('writes runtime spellings in canonical order followed by unknown values', () => {
    expect(mergeOperators(new Set(['isNull', 'lte', 'eq']), ['regex'])).toEqual(['eq', 'lte', 'isNull', 'regex']);
  });
});
