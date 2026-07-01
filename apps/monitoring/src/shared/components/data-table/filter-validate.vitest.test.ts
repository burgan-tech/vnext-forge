import { describe, expect, it } from 'vitest';
import { validateFilterGroup, validateQueryParamFilters } from './filter-validate';
import type { FilterableColumn, FilterGroup } from './types';

const columns: FilterableColumn[] = [
  { id: 'status', label: 'Status', type: 'select' },
  { id: 'key', label: 'Key', type: 'text' },
];

describe('validateFilterGroup', () => {
  it('keeps conditions on known columns and drops unknown ones', () => {
    const raw: FilterGroup = {
      kind: 'group', id: 'root', combinator: 'and',
      children: [
        { kind: 'condition', id: 'c1', columnId: 'status', operator: 'eq', value: 'Active' },
        { kind: 'condition', id: 'c2', columnId: 'ghost', operator: 'eq', value: 'x' },
      ],
    };
    const out = validateFilterGroup(raw, columns);
    expect(out.children).toHaveLength(1);
    expect((out.children[0] as { columnId: string }).columnId).toBe('status');
  });

  it('returns an empty root for malformed input', () => {
    const out = validateFilterGroup({ nonsense: true }, columns);
    expect(out.kind).toBe('group');
    expect(out.children).toEqual([]);
  });

  it('recurses into nested groups and prunes empties', () => {
    const raw: FilterGroup = {
      kind: 'group', id: 'root', combinator: 'and',
      children: [
        { kind: 'group', id: 'g', combinator: 'or', children: [
          { kind: 'condition', id: 'c', columnId: 'ghost', operator: 'eq', value: 'x' },
        ] },
      ],
    };
    const out = validateFilterGroup(raw, columns);
    expect(out.children).toEqual([]);
  });

  it('prunes deeply nested groups that become empty', () => {
    const raw = {
      kind: 'group', id: 'root', combinator: 'and',
      children: [
        { kind: 'group', id: 'A', combinator: 'and', children: [
          { kind: 'group', id: 'B', combinator: 'or', children: [
            { kind: 'condition', id: 'c', columnId: 'ghost', operator: 'eq', value: 'x' },
          ] },
        ] },
      ],
    };
    const out = validateFilterGroup(raw, columns);
    expect(out.children).toEqual([]);
  });
});

describe('validateQueryParamFilters', () => {
  it('keeps entries whose base column exists', () => {
    const out = validateQueryParamFilters(
      { 'key[contains]': 'abc', 'ghost[eq]': 'x', status: 'Active' },
      columns,
    );
    expect(out).toEqual({ 'key[contains]': 'abc', status: 'Active' });
  });

  it('returns an empty object for non-object input', () => {
    expect(validateQueryParamFilters(null, columns)).toEqual({});
    expect(validateQueryParamFilters('nope', columns)).toEqual({});
  });
});
