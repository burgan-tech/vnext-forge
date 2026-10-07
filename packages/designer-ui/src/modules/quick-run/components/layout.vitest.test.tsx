import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PanelToggleButton } from './PanelToggleButton';
import { ResizableHandle } from './ResizableHandle';

describe('ResizableHandle', () => {
  it('renders a horizontal, focusable row handle', () => {
    const html = renderToStaticMarkup(
      createElement(ResizableHandle, { onResize: () => undefined, orientation: 'horizontal', valueNow: 200 }),
    );
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('cursor-row-resize');
    expect(html).toContain('aria-valuenow="200"');
  });

  it('keeps the vertical column handle default', () => {
    const html = renderToStaticMarkup(createElement(ResizableHandle, { onResize: () => undefined }));
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('cursor-col-resize');
    expect(html).toContain('aria-label="Resize panel"');
    expect(html).not.toContain('aria-valuenow');
  });
});

describe('PanelToggleButton', () => {
  it('labels an open panel as Hide and pressed', () => {
    const html = renderToStaticMarkup(
      createElement(PanelToggleButton, { side: 'right', open: true, onToggle: () => undefined, label: 'details panel' }),
    );
    expect(html).toContain('aria-label="Hide details panel"');
    expect(html).toContain('title="Hide details panel"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('labels a closed panel as Show and not pressed', () => {
    const html = renderToStaticMarkup(
      createElement(PanelToggleButton, { side: 'bottom', open: false, onToggle: () => undefined, label: 'timeline' }),
    );
    expect(html).toContain('aria-label="Show timeline"');
    expect(html).toContain('aria-pressed="false"');
  });
});
