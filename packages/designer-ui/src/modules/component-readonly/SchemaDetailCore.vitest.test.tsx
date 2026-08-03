import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { SchemaTreeEditor } from '../schema-editor/components/tree-editor/SchemaTreeEditor.js';
import { useSchemaSelectionStore } from '../schema-editor/hooks/useSchemaSelection.js';
import { useSchemaEditorStore } from '../schema-editor/useSchemaEditorStore.js';
import { SchemaDetailCore } from './SchemaDetailCore.js';

const SCHEMA_DOC: Record<string, unknown> = {
  key: 'customer',
  version: '1.0.0',
  domain: 'core',
  flow: 'sys-schemas',
  attributes: {
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        address: {
          type: 'object',
          required: ['city'],
          properties: { city: { type: 'string' } },
        },
      },
    },
  },
};

/**
 * Seed the schema editor store for a static server render.
 *
 * zustand v5 renders the useSyncExternalStore *server snapshot* during
 * `renderToStaticMarkup`, and that snapshot is `getInitialState()` — a stable
 * object captured at `create()` time that `setState` never touches. So besides
 * the regular `setComponent` (what the runtime seeding path uses), the initial
 * state object itself must carry the document, otherwise SSR always renders an
 * empty tree. Restored in `afterEach`.
 */
function seedStore(doc: Record<string, unknown> = SCHEMA_DOC): void {
  const json = structuredClone(doc);
  useSchemaEditorStore.getState().setComponent(json, '');
  useSchemaSelectionStore.getState().reset();
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: json, filePath: '' });
}

afterEach(() => {
  useSchemaEditorStore.getState().clear();
  useSchemaSelectionStore.getState().reset();
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: null, filePath: null });
});

describe('SchemaDetailCore', () => {
  it('shows an empty state when there is no schema payload', () => {
    const html = renderToStaticMarkup(
      h(SchemaDetailCore, {
        json: {
          key: 's-empty',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-schemas',
          attributes: {},
        },
      }),
    );
    expect(html).toContain('No schema definition');
  });

  it('renders the seeding skeleton (not the empty state) when a schema is present', () => {
    // Static SSR never runs effects, so the store-seeding path stays pending;
    // the component must show the Skeleton placeholder, not "No schema".
    const html = renderToStaticMarkup(h(SchemaDetailCore, { json: SCHEMA_DOC }));
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain('No schema definition');
    expect(html).toContain('Schema Metadata');
  });

  it('accepts the flattened monitor-API shape (schema at the top level)', () => {
    const html = renderToStaticMarkup(
      h(SchemaDetailCore, {
        json: {
          key: 's-flat',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-schemas',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      }),
    );
    // normalizeDefinitionDoc lifts `schema` into `attributes.schema`, so the
    // tree path (skeleton until seeded) is taken instead of the empty state.
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain('No schema definition');
  });
});

describe('SchemaTreeEditor under FormReadOnlyProvider (monitoring mode)', () => {
  it('renders the property tree with no add/delete/move/drag affordances', () => {
    seedStore();

    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(SchemaTreeEditor)),
    );

    // Real tree content renders, including nested properties.
    expect(html).toContain('name');
    expect(html).toContain('age');
    expect(html).toContain('city');
    expect(html).toContain('Schema root');

    // Required indicator stays visible.
    expect(html).toContain('title="Required"');

    // Edit affordances are gone entirely.
    expect(html).not.toContain('Add property');
    expect(html).not.toContain('Add nested');
    expect(html).not.toContain('Delete name');
    expect(html).not.toContain('Move name up');
    expect(html).not.toContain('Move name down');
    expect(html).not.toContain('Drag name');
    expect(html).not.toContain('draggable="true"');
  });
});

describe('SchemaTreeEditor without the provider (forge default-off proof)', () => {
  it('keeps every edit affordance when useFormReadOnly() is false', () => {
    seedStore();

    const html = renderToStaticMarkup(h(SchemaTreeEditor));

    expect(html).toContain('Add property');
    expect(html).toContain('Delete name');
    expect(html).toContain('Move name up');
    expect(html).toContain('Drag name');
    expect(html).toContain('draggable="true"');
  });
});
