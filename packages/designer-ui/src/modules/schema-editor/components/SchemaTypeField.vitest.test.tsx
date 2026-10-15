import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaTypeField, type SchemaTypeFieldProps } from './SchemaTypeField';

const render = (value: string, extra: Partial<SchemaTypeFieldProps> = {}): string =>
  renderToStaticMarkup(createElement(SchemaTypeField, { value, onCommit: () => undefined, ...extra }));

describe('SchemaTypeField — vnext-schema ≥ 0.0.56 (roles)', () => {
  it('offers no role and the four roles', () => {
    const html = render('master', { schemaVersion: '0.0.56' });
    expect(html).toContain('Schema role');
    expect(html).toContain('<option value="">No role</option>');
    for (const role of ['master', 'transition', 'component', 'function']) {
      expect(html).toContain(`<option value="${role}"`);
    }
  });

  it('treats an unknown pin as role-enforcing (bundled package)', () => {
    expect(render('')).toContain('Schema role');
  });

  it('flags a legacy value and offers the suggested role', () => {
    const html = render('schema', { schemaVersion: '0.0.56', suggestedRole: 'transition' });
    expect(html).toContain('schema (legacy)');
    expect(html).toContain('legacy type');
    expect(html).toContain('Use transition');
  });

  it('does not offer a suggestion without one', () => {
    expect(render('headers', { schemaVersion: '0.0.56' })).not.toContain('Use ');
  });

  it('shows the save-time error', () => {
    expect(render('', { schemaVersion: '0.0.56', errorMsg: 'must be equal to one of the allowed values' })).toContain(
      'must be equal to one of the allowed values',
    );
  });
});

describe('SchemaTypeField — pins below 0.0.56 (free text)', () => {
  it('renders the current value with the four suggestions', () => {
    const html = render('schema', { schemaVersion: '0.0.55' });
    expect(html).toContain('value="schema"');
    for (const option of ['master', 'schema', 'view', 'headers']) {
      expect(html).toContain(`<option value="${option}">`);
    }
  });

  it('explains that only master permits x-indexed', () => {
    expect(render('view', { schemaVersion: '0.0.55' })).toContain('permits x-indexed');
  });

  it('warns when the pinned vnext-schema still restricts attributes.type', () => {
    const html = render('master', { schemaVersion: '0.0.53' });
    expect(html).toContain('0.0.53');
    expect(html).toContain('npm run validate');
  });

  it('does not warn for a legacy-enum value even on an old pin', () => {
    expect(render('schema', { schemaVersion: '0.0.53' })).not.toContain('npm run validate');
  });

  it('does not warn once the pinned version allows free text', () => {
    expect(render('master', { schemaVersion: '0.0.54' })).not.toContain('npm run validate');
  });
});
