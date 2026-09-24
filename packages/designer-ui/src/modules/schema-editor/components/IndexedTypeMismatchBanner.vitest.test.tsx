import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormReadOnlyProvider } from '../../../ui/FormReadOnlyContext';
import { INDEX_MESSAGES } from '../model/indexEligibility';
import { IndexBadge } from './tree-editor/property-tree/IndexBadge';
import { IndexedTypeMismatchBanner } from './IndexedTypeMismatchBanner';

const doc = (type: string): Record<string, unknown> => ({
  key: 'orders',
  attributes: {
    type,
    schema: {
      properties: {
        a: { type: 'number', 'x-indexed': true },
        b: { type: 'string', 'x-indexed': false },
      },
    },
  },
});

const banner = (json: Record<string, unknown>): ReturnType<typeof createElement> =>
  createElement(IndexedTypeMismatchBanner, { json, onChange: () => undefined });

describe('IndexedTypeMismatchBanner', () => {
  it('names the count and the type and offers the cleanup', () => {
    const html = renderToStaticMarkup(banner(doc('view')));
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).toContain('>view<');
    expect(html).toContain('Remove all x-indexed');
  });

  it('hides the cleanup in read-only hosts', () => {
    const html = renderToStaticMarkup(createElement(FormReadOnlyProvider, null, banner(doc('view'))));
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).not.toContain('Remove all x-indexed');
  });

  it('renders nothing for a master schema', () => {
    expect(renderToStaticMarkup(banner(doc('master')))).toBe('');
  });
});

describe('IndexBadge', () => {
  const info = { pointer: '/properties/a', path: 'a', eligible: true, indexed: true };

  it('marks an indexed field', () => {
    const html = renderToStaticMarkup(createElement(IndexBadge, { info }));
    expect(html).toContain('IDX');
    expect(html).toContain('title="Indexed (x-indexed: true)"');
  });

  it('carries the violation as the title', () => {
    const html = renderToStaticMarkup(
      createElement(IndexBadge, { info: { ...info, eligible: false, reason: 'notScalar' as const } }),
    );
    expect(html).toContain(`title="${INDEX_MESSAGES.notScalar}"`);
  });

  it('renders nothing unless x-indexed is true', () => {
    expect(renderToStaticMarkup(createElement(IndexBadge, { info: { ...info, indexed: false } }))).toBe('');
    expect(renderToStaticMarkup(createElement(IndexBadge, { info: undefined }))).toBe('');
  });
});
