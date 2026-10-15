import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { FormReadOnlyProvider } from '../../../../../../ui/FormReadOnlyContext.js';
import { useSchemaEditorStore } from '../../../../useSchemaEditorStore.js';
import { VNextTab } from './VNextTab.js';

const DOC: Record<string, unknown> = {
  key: 'customer',
  version: '1.0.0',
  domain: 'core',
  flow: 'sys-schemas',
  attributes: {
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          'x-labels': { en: 'Full name', tr: 'Ad Soyad', de: 'Vollständiger Name' },
        },
      },
    },
  },
};

/**
 * zustand v5 renders `getInitialState()` as the SSR snapshot, so the store is
 * seeded on BOTH the live state (runtime path) and the initial-state object
 * (what `renderToStaticMarkup` reads). Restored in `afterEach`.
 */
function seed(json: Record<string, unknown>) {
  useSchemaEditorStore.getState().setComponent(json, '');
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: json, filePath: '' });
}

afterEach(() => {
  useSchemaEditorStore.getState().clear();
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: null, filePath: null });
});

describe('VNextTab (read-only)', () => {
  it('renders EVERY scoped card with Set / Not set badges, all languages visible', () => {
    seed(DOC);
    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(VNextTab, { pointer: '/properties/name' })),
    );

    // The set keyword shows its content — every language entry, not just one.
    expect(html).toContain('Full name');
    expect(html).toContain('Ad Soyad');
    expect(html).toContain('Vollständiger Name');
    expect(html).toContain('>Set<');

    // Unset keywords still render, collapsed, flagged as not set.
    expect(html).toContain('x-roles');
    expect(html).toContain('x-sortable');
    expect(html).toContain('Not set');
    // The old read-only empty/filter behavior must be gone.
    expect(html).not.toContain('No vNext annotations');
  });

  it('keeps the editable toggle in edit mode (no provider)', () => {
    seed(DOC);
    const html = renderToStaticMarkup(h(VNextTab, { pointer: '/properties/name' }));
    expect(html).toContain('Enabled');
    expect(html).not.toContain('>Set<');
    expect(html).not.toContain('Not set');
  });
});

describe('VNextTab (schema roles)', () => {
  const withRole = (type: string, extra: Record<string, unknown> = {}) => ({
    ...DOC,
    attributes: {
      type,
      schema: { type: 'object', properties: { name: { type: 'string', ...extra } } },
    },
  });

  it('hides cards the transition role refuses and lists them', () => {
    seed(withRole('transition'));
    const html = renderToStaticMarkup(h(VNextTab, { pointer: '/properties/name' }));
    expect(html).toContain('x-labels');
    expect(html).toContain('x-context-source');
    expect(html).toContain('Not available on a transition schema');
    expect(html).not.toContain('Remove x-');
  });

  it('flags a refused annotation already on the node with a remove action', () => {
    seed(withRole('transition', { 'x-sortable': true }));
    const html = renderToStaticMarkup(h(VNextTab, { pointer: '/properties/name' }));
    expect(html).toContain('x-sortable is not allowed on a transition schema. Allowed on: master.');
    expect(html).toContain('Remove x-sortable');
  });

  it('keeps record cards on a master schema and hides input/component ones', () => {
    seed(withRole('master'));
    const html = renderToStaticMarkup(h(VNextTab, { pointer: '/properties/name' }));
    expect(html).toContain('x-roles');
    expect(html).toContain('x-indexed');
    expect(html).toContain('Not available on a master schema: <span class="font-mono">x-binding, x-context-source</span>');
  });

  it('applies no gate to a legacy type', () => {
    seed(withRole('schema', { 'x-sortable': true }));
    const html = renderToStaticMarkup(h(VNextTab, { pointer: '/properties/name' }));
    expect(html).not.toContain('Not available on');
    expect(html).not.toContain('is not allowed');
  });
});
