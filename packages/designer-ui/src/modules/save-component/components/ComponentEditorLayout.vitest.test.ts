import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ComponentEditorLayout } from './ComponentEditorLayout.js';

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
});
