import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PseudoViewDelegate } from '@burgan-tech/pseudo-ui';

import type { ViewResponse } from '../types/quickrun.types';
import { PseudoUiViewSurface } from './PseudoUiViewSurface';

// The real frame pulls in the SDK's React adapter (PrimeReact), which node
// cannot resolve outside a bundler. The surface chrome is what is under test.
// The mock records the delegate the surface hands the SDK.
const frame = vi.hoisted(() => ({ delegate: null as PseudoViewDelegate | null }));
vi.mock('./PseudoUiPseudoViewFrame', () => ({
  PseudoUiPseudoViewFrame: (props: { delegate: PseudoViewDelegate }) => {
    frame.delegate = props.delegate;
    return null;
  },
}));

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

describe('PseudoUiViewSurface delegate', () => {
  it('forwards the SDK dispatch context (4th onAction argument) to the host delegate', async () => {
    const onAction = vi.fn(() => Promise.resolve());
    renderToStaticMarkup(
      <PseudoUiViewSurface
        viewResponse={view({ type: 'Column', children: [] })}
        mode="simulation"
        ariaLabel="View"
        delegate={{ onAction } as unknown as PseudoViewDelegate}
      />,
    );
    const context = { phase: 'pre' as const, sync: true };
    await frame.delegate?.onAction('notify', { a: 1 }, 'cmd', context);
    expect(onAction).toHaveBeenCalledWith('notify', { a: 1 }, 'cmd', context);
  });
});
