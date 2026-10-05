import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const feature = vi.hoisted(() => ({ supported: true, schemaVersion: '0.0.55' as string | undefined }));
vi.mock('./useSchemaFeature', () => ({ useSchemaFeature: () => feature }));

const { RoleGrantEditor } = await import('./RoleGrantEditor');

const render = (roles: Parameters<typeof RoleGrantEditor>[0]['roles']) =>
  renderToStaticMarkup(createElement(RoleGrantEditor, { roles, onChange: () => {} }));

describe('RoleGrantEditor (shared by every role surface)', () => {
  it('offers All of / Any of on a supporting schema, from scratch', () => {
    feature.supported = true;
    const html = render([{ role: 'maker', grant: 'allow' }]);
    expect(html).toContain('>All of</option>');
    expect(html).not.toMatch(/<option value="allOf" disabled/);
    expect(html).not.toContain('needs vnext-schema');
  });

  it('keeps the kinds visible but disabled, with the reason, on an older schema', () => {
    feature.supported = false;
    feature.schemaVersion = '0.0.52';
    const html = render([{ role: 'maker', grant: 'allow' }]);
    expect(html).toMatch(/<option value="allOf" disabled=""/);
    expect(html).toContain('needs vnext-schema 0.0.55 or later; this project uses 0.0.52');
  });

  it('always renders an existing group with Add condition', () => {
    feature.supported = false;
    const html = render([{ anyOf: [{ role: 'a' }, { role: 'b' }], grant: 'deny' }]);
    expect(html).toContain('Add condition');
    expect(html).toContain('value="a"');
    expect(html).toContain('value="b"');
  });
});
