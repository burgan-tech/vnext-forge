import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../quick-run/pseudo-ui/PseudoUiLangPicker', () => ({
  PseudoUiLangPicker: () => createElement('span', { 'data-testid': 'lang-picker' }),
}));

const { FunctionRunViewSection } = await import('./FunctionRunViewSection.js');

const pseudoView = { key: 'branch-form', type: 'pseudo-ui', renderer: 'pseudo-ui', content: {} };
const jsonView = { key: 'raw-view', type: 'json', renderer: 'json', content: {} };

function render(over: Record<string, unknown> = {}) {
  const { children, ...rest } = over;
  return renderToStaticMarkup(
    createElement(
      FunctionRunViewSection,
      { title: 'Input view', view: null, emptyMessage: 'Nothing declared', ...rest } as never,
      children as never,
    ),
  );
}

describe('FunctionRunViewSection', () => {
  it('shows the fixed section title', () => {
    expect(render()).toContain('Input view');
  });

  it('shows the empty message when there is no view, no loading, no error', () => {
    const html = render({ emptyMessage: 'This function declares no input view' });
    expect(html).toContain('This function declares no input view');
  });

  it('prefers the loading state over the empty message', () => {
    const html = render({ loading: true, emptyMessage: 'This function declares no input view' });
    expect(html).toContain('Loading view');
    expect(html).not.toContain('This function declares no input view');
  });

  it('prefers the error state over the empty message and over children', () => {
    const html = render({
      error: 'Could not load the input view',
      view: pseudoView,
      children: createElement('span', {}, 'CHILD_MARKER'),
    });
    expect(html).toContain('Could not load the input view');
    expect(html).not.toContain('CHILD_MARKER');
  });

  it('renders children only when a view is present and there is no loading/error', () => {
    const html = render({ view: pseudoView, children: createElement('span', {}, 'CHILD_MARKER') });
    expect(html).toContain('CHILD_MARKER');
  });

  it('does not render children when there is no view', () => {
    const html = render({ view: null, children: createElement('span', {}, 'CHILD_MARKER') });
    expect(html).not.toContain('CHILD_MARKER');
  });

  it('shows the view key and type badge in the meta strip', () => {
    const html = render({ view: pseudoView, children: createElement('span', {}, 'x') });
    expect(html).toContain('branch-form');
    expect(html).toContain('>pseudo-ui<');
  });

  it('shows the renderer badge when the view declares one', () => {
    const html = render({ view: jsonView, children: createElement('span', {}, 'x') });
    // Both the type ("json") and renderer ("json") badges render for this
    // fixture — count occurrences so a mutation that drops the renderer
    // badge (identical text to the type badge here) is still caught.
    expect((html.match(/>json</g) ?? []).length).toBe(2);
  });

  it('shows the language picker only for a pseudo-ui view', () => {
    const pseudoHtml = render({ view: pseudoView, children: createElement('span', {}, 'x') });
    expect(pseudoHtml).toContain('data-testid="lang-picker"');

    const jsonHtml = render({ view: jsonView, children: createElement('span', {}, 'x') });
    expect(jsonHtml).not.toContain('data-testid="lang-picker"');
  });

  it('does not show a meta strip at all when there is no view', () => {
    const html = render({ view: null });
    expect(html).not.toContain('data-testid="lang-picker"');
  });
});
