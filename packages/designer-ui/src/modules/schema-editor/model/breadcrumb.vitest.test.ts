import { describe, expect, it } from 'vitest';

import { buildBreadcrumb } from './breadcrumb';

describe('buildBreadcrumb', () => {
  it('returns an empty list for the root pointer', () => {
    expect(buildBreadcrumb('')).toEqual([]);
  });

  it('collapses `properties` into the following key', () => {
    expect(buildBreadcrumb('/properties/foo')).toEqual([
      { label: 'foo', pointer: '/properties/foo' },
    ]);
  });

  it('nests property paths into a chain of clickable segments', () => {
    expect(buildBreadcrumb('/properties/foo/properties/bar')).toEqual([
      { label: 'foo', pointer: '/properties/foo' },
      { label: 'bar', pointer: '/properties/foo/properties/bar' },
    ]);
  });

  it('formats composition keywords with index in brackets', () => {
    expect(buildBreadcrumb('/properties/foo/allOf/0')).toEqual([
      { label: 'foo', pointer: '/properties/foo' },
      { label: 'allOf[0]', pointer: '/properties/foo/allOf/0' },
    ]);
  });

  it('handles deeply nested mix of properties, items, and composition', () => {
    expect(buildBreadcrumb('/properties/foo/items/anyOf/1/properties/bar')).toEqual([
      { label: 'foo', pointer: '/properties/foo' },
      { label: 'items', pointer: '/properties/foo/items' },
      { label: 'anyOf[1]', pointer: '/properties/foo/items/anyOf/1' },
      { label: 'bar', pointer: '/properties/foo/items/anyOf/1/properties/bar' },
    ]);
  });

  it('formats prefixItems with the index label', () => {
    expect(buildBreadcrumb('/prefixItems/2/properties/x')).toEqual([
      { label: 'prefixItems[2]', pointer: '/prefixItems/2' },
      { label: 'x', pointer: '/prefixItems/2/properties/x' },
    ]);
  });

  it('collapses patternProperties and dependentSchemas like properties', () => {
    expect(buildBreadcrumb('/patternProperties/~1x-~1/properties/inner')).toEqual([
      { label: '/x-/', pointer: '/patternProperties/~1x-~1' },
      { label: 'inner', pointer: '/patternProperties/~1x-~1/properties/inner' },
    ]);

    expect(buildBreadcrumb('/dependentSchemas/premium/properties/tier')).toEqual([
      { label: 'premium', pointer: '/dependentSchemas/premium' },
      { label: 'tier', pointer: '/dependentSchemas/premium/properties/tier' },
    ]);
  });

  it('leaves standalone keywords (items, not, contains) visible', () => {
    expect(buildBreadcrumb('/items/not/contains')).toEqual([
      { label: 'items', pointer: '/items' },
      { label: 'not', pointer: '/items/not' },
      { label: 'contains', pointer: '/items/not/contains' },
    ]);
  });
});
