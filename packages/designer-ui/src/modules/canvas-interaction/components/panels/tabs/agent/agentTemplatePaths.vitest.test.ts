import { describe, expect, it } from 'vitest';

import { filterTemplatePaths, insertTemplatePath, openPlaceholderAt, schemaDataPaths } from './agentTemplatePaths';

describe('schemaDataPaths', () => {
  it('lists nested properties and the first element of arrays', () => {
    expect(
      schemaDataPaths({
        type: 'object',
        properties: {
          customer: { type: 'object', properties: { name: { type: 'string' } } },
          items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' } } } },
          message: { type: 'string' },
        },
      }),
    ).toEqual(['data.customer', 'data.customer.name', 'data.items', 'data.items[0]', 'data.items[0].sku', 'data.message']);
  });
});

describe('placeholder editing', () => {
  it('finds the open token before the caret', () => {
    expect(openPlaceholderAt('Hi {{ data.cu', 13)).toEqual({ query: 'data.cu', start: 6 });
    expect(openPlaceholderAt('Hi {{ data.x }} ', 16)).toBeNull();
    expect(openPlaceholderAt('no braces', 4)).toBeNull();
  });

  it('inserts and closes a path, keeps a root prefix open', () => {
    expect(insertTemplatePath('Hi {{da', 5, 7, 'data.message')).toEqual({ text: 'Hi {{ data.message }}', caret: 21 });
    expect(insertTemplatePath('Hi {{ da }}!', 6, 8, 'data.message')).toEqual({ text: 'Hi {{ data.message }}!', caret: 19 });
    expect(insertTemplatePath('{{ b', 3, 4, 'body.')).toEqual({ text: '{{ body.', caret: 8 });
  });

  it('filters by prefix first, then by substring', () => {
    expect(filterTemplatePaths(['data.name', 'instance.key', 'data.customer.name'], 'name')).toEqual([
      'data.name',
      'data.customer.name',
    ]);
    expect(filterTemplatePaths(['data.name', 'instance.key'], 'inst')).toEqual(['instance.key']);
  });
});
