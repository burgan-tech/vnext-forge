import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ViewDetailCore } from './ViewDetailCore.js';

const base = { key: 'onboarding-view', version: '1.0.0', domain: 'core', flow: 'sys-views' };

const pseudoUiJson = {
  ...base,
  attributes: {
    type: '1',
    display: 'full-page',
    renderer: 'pseudo-ui',
    content: { view: { children: [] } },
  },
};

describe('ViewDetailCore', () => {
  it('renders view metadata with type/display/renderer and a preview/raw toggle', () => {
    const html = renderToStaticMarkup(h(ViewDetailCore, { json: pseudoUiJson }));
    expect(html).toContain('value="JSON"');
    expect(html).toContain('value="full-page"');
    expect(html).toContain('value="pseudo-ui"');
    // The raw editor stays reachable for every type through this toggle; the
    // default tab is 'preview', so only the buttons can be asserted here.
    expect(html).toContain('>Preview<');
    expect(html).toContain('>Raw<');
  });

  it('renders link-type views as a target field', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: {
          ...base,
          attributes: { type: '4', display: 'popup', content: { href: 'https://x.example' } },
        },
      }),
    );
    expect(html).toContain('https://x.example');
    expect(html).toContain('value="Deep Link"');
  });

  it('accepts numeric type from the flattened monitor-API shape', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, { json: { ...base, type: 2, display: 'drawer', content: '<b>hello</b>' } }),
    );
    expect(html).toContain('value="HTML"');
    expect(html).toContain('value="drawer"');
  });

  it('reads a link target that arrives as stringified JSON', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, type: 5, content: '{"href":"https://stringified.example"}' },
      }),
    );
    expect(html).toContain('value="HTTP"');
    expect(html).toContain('value="https://stringified.example"');
  });

  it('reads the URN key for URN views and defaults display to full-page', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, { json: { ...base, type: 6, content: { urn: 'urn:vnext:view:x' } } }),
    );
    expect(html).toContain('value="URN"');
    expect(html).toContain('urn:vnext:view:x');
    expect(html).toContain('value="full-page"');
  });

  it('renders both modes for a per-mode display declaration', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, attributes: { type: 1, display: { sdi: 'popup', mdi: 'drawer' }, content: {} } },
      }),
    );
    // Before SDI/MDI support this rendered `full-page` — a value the component
    // never declared — because the object failed a `typeof === 'string'` test.
    expect(html).toContain('value="popup"');
    expect(html).toContain('value="drawer"');
    expect(html).not.toContain('value="full-page"');
  });

  it('shows the SDI default and omits the MDI row for an MDI-only declaration', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, attributes: { type: 1, display: { mdi: 'top-sheet' }, content: {} } },
      }),
    );
    expect(html).toContain('value="top-sheet"');
    expect(html).toContain('Display (MDI)');
    // No SDI value was declared, so the effective client default stands in.
    expect(html).toContain('value="full-page"');
  });

  it('omits the MDI row entirely for an SDI-only declaration', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, attributes: { type: 1, display: 'drawer', content: {} } },
      }),
    );
    expect(html).toContain('value="drawer"');
    expect(html).not.toContain('Display (MDI)');
  });

  it('previews HTML views inside a fully sandboxed iframe and keeps raw reachable', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, { json: { ...base, type: 2, content: '<b>hello</b>' } }),
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('sandbox=""');
    expect(html).toContain('title="HTML preview"');
    // The HTML never reaches the surrounding document unescaped. (React's static
    // renderer keeps the `srcDoc` prop spelling; HTML attribute names are
    // case-insensitive, so the browser still reads it as `srcdoc`.)
    expect(html).toMatch(/srcdoc="&lt;b&gt;hello&lt;\/b&gt;"/i);
    expect(html).not.toContain('<b>hello</b>');
    expect(html).toContain('>Raw<');
  });

  it('renders markdown views through the shared markdown preview', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, { json: { ...base, type: 3, content: '**bold**' } }),
    );
    expect(html).toContain('<strong>bold</strong>');
  });

  it('shows a message for pseudo-ui views when no host renderer is supplied', () => {
    const html = renderToStaticMarkup(h(ViewDetailCore, { json: pseudoUiJson }));
    expect(html).toContain('Pseudo-ui preview is not available.');
  });

  it('delegates the pseudo-ui preview to the host renderer with the parsed content', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: pseudoUiJson,
        renderPseudoUiPreview: (content) =>
          h('div', { 'data-testid': 'pseudo-surface' }, Object.keys(content).join(',')),
      }),
    );
    expect(html).toContain('data-testid="pseudo-surface"');
    expect(html).toContain('>view<');
  });

  it('accepts stringified pseudo-ui content for the host renderer', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, type: 1, renderer: 'pseudo-ui', content: '{"view":{"children":[]}}' },
        renderPseudoUiPreview: () => h('div', null, 'surface-ok'),
      }),
    );
    expect(html).toContain('surface-ok');
  });

  it('warns when pseudo-ui content is not a JSON object', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, type: 1, renderer: 'pseudo-ui', content: 'not json' },
        renderPseudoUiPreview: () => h('div', null, 'surface-ok'),
      }),
    );
    expect(html).toContain('does not carry a valid pseudo-ui JSON object');
    expect(html).not.toContain('surface-ok');
  });

  it('previews non-pseudo-ui JSON views as pretty-printed static JSON', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, type: 1, renderer: 'custom', content: { a: 1 } },
      }),
    );
    expect(html).toContain('<pre');
    expect(html).toContain('&quot;a&quot;: 1');
  });
});
