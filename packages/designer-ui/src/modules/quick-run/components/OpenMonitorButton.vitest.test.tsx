import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OpenMonitorButton } from './OpenMonitorButton';

describe('OpenMonitorButton', () => {
  it('renders an accessible pointer button', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const html = renderToStaticMarkup(h(OpenMonitorButton, { onClick: () => {} }));
    expect(html).toContain('aria-label="Monitor this instance"');
    expect(html).toContain('cursor-pointer');
  });
});
