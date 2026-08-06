import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ComponentEditorLayout, type ComponentEditorLayoutProps } from './ComponentEditorLayout.js';

function renderLayoutBodyClass(props: { registerToolbar?: (toolbar: unknown) => void } = {}) {
  const html = renderToStaticMarkup(
    createElement(
      ComponentEditorLayout,
      {
        isDirty: false,
        onSave: () => {},
        ...props,
      },
      createElement('div', { 'data-body-child': 'yes' }),
    ),
  );
  const beforeChild = html.split('<div data-body-child="yes"></div>')[0] ?? '';
  const classMatches = Array.from(beforeChild.matchAll(/class="([^"]*)"/g));
  return classMatches[classMatches.length - 1]?.[1] ?? '';
}

// `registerToolbar` deliberately omitted: with it set, `ComponentEditorLayout`
// hands the toolbar node to the (no-op, in a test) callback instead of
// rendering it inline, so the embedded-toolbar path below is the only one
// where the toggle button actually lands in `renderToStaticMarkup`'s output.
function renderEmbeddedToolbar(props: Partial<ComponentEditorLayoutProps> = {}) {
  return renderToStaticMarkup(
    createElement(
      ComponentEditorLayout,
      { isDirty: false, onSave: () => {}, ...props },
      createElement('div', null),
    ),
  );
}

describe('ComponentEditorLayout', () => {
  it('keeps the editor body shrinkable when the toolbar is embedded in extension webviews', () => {
    expect(renderLayoutBodyClass().split(' ')).toEqual(
      expect.arrayContaining(['min-h-0', 'min-w-0', 'flex-1', 'overflow-y-auto']),
    );
  });

  it('keeps the editor body shrinkable when the toolbar is hoisted to the web shell', () => {
    expect(renderLayoutBodyClass({ registerToolbar: () => {} }).split(' ')).toEqual(
      expect.arrayContaining(['min-h-0', 'min-w-0', 'flex-1', 'overflow-y-auto']),
    );
  });

  it('omits the Run toggle when the host has not wired onToggleRun (e.g. modal surface)', () => {
    expect(renderEmbeddedToolbar()).not.toMatch(/aria-label="Run"/);
  });

  it('shows the Run toggle, unpressed, when the host wires onToggleRun and Run is closed', () => {
    const html = renderEmbeddedToolbar({ onToggleRun: () => {}, runOpen: false });
    expect(html).toMatch(/aria-label="Run"[^>]*aria-pressed="false"/);
  });

  it('flips the Run toggle to its pressed, "Close Run panel" state when runOpen is true', () => {
    const html = renderEmbeddedToolbar({ onToggleRun: () => {}, runOpen: true });
    expect(html).toMatch(/aria-label="Close Run panel"[^>]*aria-pressed="true"/);
    expect(html).not.toMatch(/aria-label="Run"[^>]*aria-pressed="false"/);
  });
});
