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
