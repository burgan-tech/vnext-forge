import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton.js';

describe('Skeleton', () => {
  it('renders a pulsing placeholder with merged classes', () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: 'h-4 w-32' }));
    expect(html).toContain('animate-pulse');
    expect(html).toContain('h-4');
    expect(html).toContain('w-32');
    expect(html).toContain('aria-hidden');
  });

  it('respects reduced motion', () => {
    const html = renderToStaticMarkup(createElement(Skeleton));
    expect(html).toContain('motion-reduce:animate-none');
  });

  it('marks itself as a skeleton slot', () => {
    const html = renderToStaticMarkup(createElement(Skeleton));
    expect(html).toContain('data-slot="skeleton"');
  });
});
