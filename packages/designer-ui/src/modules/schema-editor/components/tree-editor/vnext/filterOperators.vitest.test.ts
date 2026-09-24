import { describe, expect, it } from 'vitest';
import { mergeOperators, splitOperators } from './filterOperators';

describe('filterOperators', () => {
  it('separates known operators from unknown spellings', () => {
    expect(splitOperators(['eq', 'gte', 'eq', 'contains', 3])).toEqual({
      known: ['eq'],
      unknown: ['gte', 'contains'],
    });
  });

  it('returns empty lists for non-arrays', () => {
    expect(splitOperators(undefined)).toEqual({ known: [], unknown: [] });
  });

  it('writes known operators in canonical order and keeps unknown ones', () => {
    expect(mergeOperators(new Set(['lt', 'eq']), ['gte', 'contains'])).toEqual(['eq', 'lt', 'gte', 'contains']);
  });
});
