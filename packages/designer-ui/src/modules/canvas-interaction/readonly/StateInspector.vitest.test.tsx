import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateInspector } from './StateInspector.js';
import type { StateView } from './view-types.js';

const STATE: StateView = {
  key: 'application-received',
  stateType: 2,
  labels: [
    { language: 'en-US', label: 'Application Received' },
    { language: 'tr-TR', label: 'Başvuru Alındı' },
    { language: 'de-DE', label: 'Antrag Eingegangen' },
  ],
} as StateView;

describe('StateInspector header labels', () => {
  it('shows EVERY language entry with its language code, not just one pick', () => {
    const html = renderToStaticMarkup(h(StateInspector, { state: STATE }));
    expect(html).toContain('Application Received');
    expect(html).toContain('Başvuru Alındı');
    expect(html).toContain('Antrag Eingegangen');
    expect(html).toContain('en-US');
    expect(html).toContain('tr-TR');
    expect(html).toContain('de-DE');
  });

  it('renders no label row when the state has no labels', () => {
    const html = renderToStaticMarkup(
      h(StateInspector, { state: { key: 's1', stateType: 1 } as StateView }),
    );
    expect(html).toContain('s1');
  });
});
