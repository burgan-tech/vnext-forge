import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReadOnlyCodeField } from './ReadOnlyCodeField.js';

describe('ReadOnlyCodeField', () => {
  it('renders the inline editor with a full screen action', () => {
    const html = renderToStaticMarkup(
      h(ReadOnlyCodeField, { value: '{"a":1}', language: 'json', height: 160 }),
    );
    expect(html).toContain('data-slot="json-code-field"');
    expect(html).toContain('aria-label="Full screen"');
  });

  it('applies the inline height to the editor wrapper', () => {
    const html = renderToStaticMarkup(h(ReadOnlyCodeField, { value: 'x', height: 320 }));
    expect(html).toContain('height:320px');
  });

  it('renders no dialog markup while closed', () => {
    const html = renderToStaticMarkup(
      h(ReadOnlyCodeField, { value: 'var x = 1;', language: 'csharp', title: 'Mappings/x.csx' }),
    );
    expect(html).not.toContain('data-slot="dialog-content"');
    expect(html).not.toContain('data-slot="dialog-overlay"');
    // The title only exists inside the (portalled, closed) dialog header.
    expect(html).not.toContain('Mappings/x.csx');
  });
});
