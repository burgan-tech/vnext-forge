import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { DetailPageSkeleton } from './DetailPageSkeleton';

describe('DetailPageSkeleton', () => {
  const html = renderToStaticMarkup(<DetailPageSkeleton />);

  it('marks the placeholder region as busy for assistive tech', () => {
    expect(html).toContain('aria-busy="true"');
  });

  it('renders one slot per detail-page region (title, subtitle, action, tabs, 2 cards)', () => {
    const slots = html.match(/data-slot="skeleton"/g) ?? [];
    expect(slots).toHaveLength(6);
  });
});
