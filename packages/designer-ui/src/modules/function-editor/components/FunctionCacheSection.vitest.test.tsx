import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyCacheMutation, FunctionCacheSection } from './FunctionCacheSection.js';

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

describe('applyCacheMutation', () => {
  it('collapses attributes.cache back to undefined when bypassOnCacheError is toggled off then on', () => {
    // off: unchecked -> explicit false
    const afterOff = applyCacheMutation({}, (c) => {
      c.bypassOnCacheError = false;
    });
    expect(afterOff).toEqual({ bypassOnCacheError: false });

    // on again: checked (default) -> omit the key entirely
    const afterOn = applyCacheMutation({ attributes: { cache: afterOff } }, (c) => {
      c.bypassOnCacheError = undefined;
    });
    expect(afterOn).toBeUndefined();
  });

  it('collapses attributes.cache to undefined when the only set field is cleared', () => {
    const afterSet = applyCacheMutation({}, (c) => {
      c.storeName = 'statestore';
    });
    expect(afterSet).toEqual({ storeName: 'statestore' });

    const afterClear = applyCacheMutation({ attributes: { cache: afterSet } }, (c) => {
      c.storeName = undefined;
    });
    expect(afterClear).toBeUndefined();
  });

  it('sets only bypassOnCacheError:false with no undefined-valued keys lingering', () => {
    const cache = applyCacheMutation({}, (c) => {
      c.bypassOnCacheError = false;
    });
    expect(cache).toEqual({ bypassOnCacheError: false });
    expect(JSON.stringify(cache)).toBe('{"bypassOnCacheError":false}');
  });
});
