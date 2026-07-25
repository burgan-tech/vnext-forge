import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunctionCacheSection } from './FunctionCacheSection.js';

describe('FunctionCacheSection', () => {
  it('renders cache fields from attributes.cache', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionCacheSection, {
        json: { attributes: { cache: { storeName: 'statestore', ttlInSeconds: 60 } } },
        onChange: () => {},
      }),
    );
    expect(html).toContain('Cache');
    expect(html).toContain('Store Name');
    expect(html).toContain('Key Expression');
    expect(html).toContain('Vary By Headers');
  });
});
