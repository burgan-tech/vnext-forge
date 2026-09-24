import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { FilterCondition } from '../utils/instanceFilterSerializer';
import { collectMasterSchemaFields } from '../utils/masterSchemaFields';
import { FilterRow, InstanceFilterPanel, type FilterRowProps } from './InstanceFilterPanel';

const FIELDS = collectMasterSchemaFields({
  properties: {
    amount: { type: 'number', 'x-indexed': true, 'x-filterOperators': ['eq', 'gte'], 'x-sortable': true },
    note: { type: 'string' },
  },
});

const row = (over: Partial<FilterRowProps>): string =>
  renderToStaticMarkup(
    createElement(FilterRow, {
      condition: { category: 'attribute', field: 'amount', operator: 'ge', value: '', valueType: 'number' },
      onChange: () => undefined,
      onRemove: () => undefined,
      ...over,
    }),
  );

const optionValues = (html: string): string[] =>
  [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1] ?? '');

describe('FilterRow with a master schema', () => {
  it('limits operators to x-filterOperators and marks indexed fields', () => {
    const html = row({ schemaFields: FIELDS });
    expect(optionValues(html)).toEqual(expect.arrayContaining(['eq', 'ge']));
    expect(optionValues(html)).not.toContain('lt');
    expect(html).toContain('IDX');
    expect(html).toContain('reads the index column');
  });

  it('warns about fields the schema does not make filterable', () => {
    const condition: FilterCondition = { category: 'attribute', field: 'note', operator: 'eq', value: '', valueType: 'text' };
    expect(row({ condition, schemaFields: FIELDS })).toContain('no x-filterOperators');
  });

  it('keeps the type-based operators without a schema', () => {
    expect(optionValues(row({}))).toContain('lt');
  });
});

describe('InstanceFilterPanel with a master schema', () => {
  const html = renderToStaticMarkup(
    createElement(InstanceFilterPanel, {
      onApply: () => undefined,
      onClose: () => undefined,
      schemaFields: FIELDS,
      schemaKey: 'orders-master',
    }),
  );

  it('suggests attribute paths from the schema', () => {
    expect(html).toContain('<datalist');
    expect(html).toContain('value="amount"');
    expect(html).toContain('number · IDX');
    expect(html).toContain('orders-master');
  });

  it('offers x-sortable fields as attributes.<path> sort options', () => {
    expect(html).toContain('value="attributes.amount"');
    expect(html).toContain('amount · IDX');
  });
});
