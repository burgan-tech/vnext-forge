import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaIndexTypeWarning } from './SchemaIndexTypeWarning';

describe('SchemaIndexTypeWarning', () => {
  it('names the schema, the count and the type', () => {
    const html = renderToStaticMarkup(
      createElement(SchemaIndexTypeWarning, {
        schemaKey: 'orders-master',
        mismatch: { schemaType: 'schema', indexedPointers: ['/properties/a', '/properties/b'] },
      }),
    );
    expect(html).toContain('orders-master');
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).toContain('>schema<');
    expect(html).toContain('role="alert"');
  });

  it('labels a missing type', () => {
    const html = renderToStaticMarkup(
      createElement(SchemaIndexTypeWarning, {
        schemaKey: 'orders-master',
        mismatch: { schemaType: undefined, indexedPointers: ['/properties/a'] },
      }),
    );
    expect(html).toContain('x-indexed on 1 field');
    expect(html).toContain('(not set)');
  });

  it('renders nothing without a mismatch', () => {
    expect(renderToStaticMarkup(createElement(SchemaIndexTypeWarning, { schemaKey: 'x', mismatch: null }))).toBe('');
  });
});
