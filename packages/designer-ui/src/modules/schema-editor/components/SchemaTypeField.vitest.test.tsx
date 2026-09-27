import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaTypeField } from './SchemaTypeField';

const render = (value: string, errorMsg?: string, schemaVersion?: string): string =>
  renderToStaticMarkup(
    createElement(SchemaTypeField, {
      value,
      onCommit: () => undefined,
      ...(errorMsg ? { errorMsg } : {}),
      ...(schemaVersion !== undefined ? { schemaVersion } : {}),
    }),
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

  it('warns when the pinned vnext-schema still restricts attributes.type', () => {
    const html = render('master', undefined, '0.0.53');
    expect(html).toContain('0.0.53');
    expect(html).toContain('npm run validate');
  });

  it('does not warn for a legacy-enum value even on an old pin', () => {
    expect(render('schema', undefined, '0.0.53')).not.toContain('npm run validate');
  });

  it('does not warn once the pinned version allows free text', () => {
    expect(render('master', undefined, '0.1.0')).not.toContain('npm run validate');
  });
});
