import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaTypeField } from './SchemaTypeField';

const render = (value: string, errorMsg?: string): string =>
  renderToStaticMarkup(
    createElement(SchemaTypeField, { value, onCommit: () => undefined, ...(errorMsg ? { errorMsg } : {}) }),
  );

describe('SchemaTypeField', () => {
  it('renders the current value with the four suggestions', () => {
    const html = render('schema');
    expect(html).toContain('value="schema"');
    for (const option of ['master', 'schema', 'view', 'headers']) {
      expect(html).toContain(`<option value="${option}">`);
    }
  });

  it('explains that only master permits x-indexed', () => {
    expect(render('view')).toContain('permits x-indexed');
  });

  it('shows the save-time error', () => {
    expect(render('', 'must be string')).toContain('must be string');
  });
});
