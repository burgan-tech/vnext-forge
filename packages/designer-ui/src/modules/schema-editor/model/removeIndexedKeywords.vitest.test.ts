import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import { removeIndexedKeywords } from './mutators';

describe('removeIndexedKeywords', () => {
  it('deletes x-indexed at every pointer and leaves the rest', () => {
    const doc = {
      key: 'k',
      attributes: {
        type: 'view',
        schema: {
          properties: {
            a: { type: 'number', 'x-indexed': true },
            b: { type: 'array', items: { properties: { c: { type: 'string', 'x-indexed': false } } } },
            d: { type: 'string', 'x-sortable': true },
          },
        },
      },
    };
    const next = produce(doc, removeIndexedKeywords(['/properties/a', '/properties/b/items/properties/c']));
    expect(next.attributes.schema.properties).toEqual({
      a: { type: 'number' },
      b: { type: 'array', items: { properties: { c: { type: 'string' } } } },
      d: { type: 'string', 'x-sortable': true },
    });
  });
});
