import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ViewResponse } from '../types/quickrun.types';
import { PseudoUiViewSurface } from './PseudoUiViewSurface';

// The real frame pulls in the SDK's React adapter (PrimeReact), which node
// cannot resolve outside a bundler. The surface chrome is what is under test.
vi.mock('./PseudoUiPseudoViewFrame', () => ({ PseudoUiPseudoViewFrame: () => null }));

function view(root: Record<string, unknown>): ViewResponse {
  return {
    renderer: 'pseudo-ui',
    content: { view: root },
  } as unknown as ViewResponse;
}

function render(root: Record<string, unknown>, props: { fullPage?: boolean } = {}) {
  return renderToStaticMarkup(
    <PseudoUiViewSurface
      viewResponse={view(root)}
      mode="simulation"
      ariaLabel="View"
      className="min-h-[200px]"
      {...props}
    />,
  );
}

describe('PseudoUiViewSurface own-frame handling', () => {
  it('drops the surface padding when the view declares its own frame', () => {
    const html = render({ type: 'Scaffold', body: { type: 'Column', children: [] } }, { fullPage: true });
    expect(html).toContain('data-own-frame="true"');
    expect(html).not.toContain('min-h-[200px]');
  });

  it('keeps the surface frame for a Column root', () => {
    const html = render({ type: 'Column', children: [] }, { fullPage: true });
    expect(html).not.toContain('data-own-frame');
    expect(html).toContain('min-h-[200px]');
  });

  it('keeps the frame for a Scaffold root outside a full-page host (dialogs)', () => {
    const html = render({ type: 'Scaffold', body: { type: 'Column', children: [] } });
    expect(html).not.toContain('data-own-frame');
    expect(html).toContain('min-h-[200px]');
  });
});
