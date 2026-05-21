import { afterEach, describe, expect, it } from 'vitest';

import {
  addProp,
  movePropToIndex,
  removeProp,
  renameProp,
  setKeyword,
  setRequired,
  setType,
  toggleVNextKey,
} from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';

function loadFixture(doc: Record<string, unknown>): void {
  useSchemaEditorStore.setState({
    componentJson: structuredClone(doc),
    filePath: 'test://schema.json',
    isDirty: false,
    undoStack: [],
    redoStack: [],
  });
}

function dump(): Record<string, unknown> {
  const next = useSchemaEditorStore.getState().componentJson;
  if (next === null) {
    throw new Error('componentJson is null');
  }
  return structuredClone(next);
}

describe('SchemaTreeEditor roundtrip', () => {
  afterEach(() => {
    useSchemaEditorStore.getState().clear();
  });

  it('preserves unknown vendor keywords across an unrelated mutation (fixture D)', () => {
    const original = {
      key: 'customer',
      version: '1.0.0',
      domain: 'demo',
      attributes: {
        schema: {
          type: 'object',
          'x-custom-vendor': { foo: 'bar', nested: [1, 2, 3] },
          examples: [{ status: 'pending' }],
          properties: {
            status: {
              type: 'string',
              'x-custom-vendor': { rule: 'preserved-on-property' },
              minLength: 2,
            },
          },
        },
      },
    };

    loadFixture(original);

    useSchemaEditorStore.getState().updateComponent(addProp('', 'newField', { type: 'string' }));
    useSchemaEditorStore
      .getState()
      .updateComponent(setKeyword('/properties/newField', 'minLength', 1));

    const after = dump();
    const schema = (after.attributes as { schema: Record<string, unknown> }).schema;

    expect(schema['x-custom-vendor']).toEqual({ foo: 'bar', nested: [1, 2, 3] });
    expect(schema.examples).toEqual([{ status: 'pending' }]);

    const statusProp = (schema.properties as Record<string, Record<string, unknown>>).status;
    expect(statusProp['x-custom-vendor']).toEqual({ rule: 'preserved-on-property' });
    expect(statusProp.minLength).toBe(2);

    const newField = (schema.properties as Record<string, Record<string, unknown>>).newField;
    expect(newField).toEqual({ type: 'string', minLength: 1 });
  });

  it('preserves the full canonical fixture under rename + required toggle + add', () => {
    const original = {
      key: 'customer',
      version: '1.0.0',
      domain: 'demo',
      attributes: {
        schema: {
          type: 'object',
          allOf: [
            {
              if: {
                properties: { customerType: { const: 'individual' } },
                required: ['customerType'],
              },
              then: { required: ['tckn'] },
            },
          ],
          properties: {
            status: {
              type: 'string',
              minLength: 2,
              maxLength: 24,
              pattern: '^[a-z]+$',
              enum: ['pending', 'approved'],
              'x-labels': { en: 'Status', tr: 'Durum' },
              'x-conditional': {
                showIf: {
                  allOf: [{ field: 'enabled', operator: 'equals', value: true }],
                },
              },
            },
          },
        },
      },
    };

    loadFixture(original);

    // Rename status → orderStatus (sıra korunmalı)
    useSchemaEditorStore.getState().updateComponent(renameProp('', 'status', 'orderStatus'));
    // Mark required (parent must keep allOf + properties intact)
    useSchemaEditorStore.getState().updateComponent(setRequired('', 'orderStatus', true));
    // Add a second property
    useSchemaEditorStore
      .getState()
      .updateComponent(addProp('', 'createdAt', { type: 'string', format: 'date-time' }));

    const after = dump();
    const schema = (after.attributes as { schema: Record<string, unknown> }).schema;

    expect(schema.allOf).toEqual(original.attributes.schema.allOf);
    expect(Object.keys(schema.properties as object)).toEqual(['orderStatus', 'createdAt']);

    const orderStatus = (schema.properties as Record<string, Record<string, unknown>>).orderStatus;
    expect(orderStatus['x-labels']).toEqual({ en: 'Status', tr: 'Durum' });
    expect(orderStatus['x-conditional']).toEqual({
      showIf: { allOf: [{ field: 'enabled', operator: 'equals', value: true }] },
    });
    expect(orderStatus.pattern).toBe('^[a-z]+$');
    expect(schema.required).toEqual(['orderStatus']);
  });

  it('removeProp clears required + leaves siblings intact', () => {
    loadFixture({
      attributes: {
        schema: {
          type: 'object',
          required: ['a', 'b'],
          properties: {
            a: { type: 'string', 'x-labels': { en: 'A' } },
            b: { type: 'number' },
            c: { type: 'boolean' },
          },
        },
      },
    });

    useSchemaEditorStore.getState().updateComponent(removeProp('', 'a'));

    const after = dump();
    const schema = (after.attributes as { schema: Record<string, unknown> }).schema;
    expect(Object.keys(schema.properties as object)).toEqual(['b', 'c']);
    expect(schema.required).toEqual(['b']);
  });

  it('setType clears type-incompatible constraint keywords but keeps title/description/x-*', () => {
    loadFixture({
      attributes: {
        schema: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              minLength: 2,
              maxLength: 20,
              title: 'Friendly name',
              description: 'A free-text field.',
              'x-labels': { en: 'Field' },
            },
          },
        },
      },
    });

    useSchemaEditorStore
      .getState()
      .updateComponent(setType('/properties/field', 'number'));

    const after = dump();
    const field = (
      ((after.attributes as { schema: Record<string, unknown> }).schema.properties as Record<
        string,
        Record<string, unknown>
      >).field
    );

    expect(field.type).toBe('number');
    expect(field.minLength).toBeUndefined();
    expect(field.maxLength).toBeUndefined();
    // Title/description and x-* should survive the type change
    expect(field.title).toBe('Friendly name');
    expect(field.description).toBe('A free-text field.');
    expect(field['x-labels']).toEqual({ en: 'Field' });
  });

  it('toggleVNextKey installs the default seed and then deletes the key on second toggle', () => {
    loadFixture({
      attributes: {
        schema: {
          type: 'object',
          properties: { foo: { type: 'string' } },
        },
      },
    });

    const seed = () => ({ en: 'Label', tr: 'Etiket' });

    useSchemaEditorStore
      .getState()
      .updateComponent(toggleVNextKey('/properties/foo', 'x-labels', seed));

    let foo = ((dump().attributes as { schema: Record<string, unknown> }).schema
      .properties as Record<string, Record<string, unknown>>).foo;
    expect(foo['x-labels']).toEqual({ en: 'Label', tr: 'Etiket' });

    useSchemaEditorStore
      .getState()
      .updateComponent(toggleVNextKey('/properties/foo', 'x-labels', seed));

    foo = ((dump().attributes as { schema: Record<string, unknown> }).schema
      .properties as Record<string, Record<string, unknown>>).foo;
    expect('x-labels' in foo).toBe(false);
  });

  it('Phase 3: roundtrips string + number + array + object constraint keywords', () => {
    const original = {
      attributes: {
        schema: {
          type: 'object',
          minProperties: 1,
          maxProperties: 12,
          additionalProperties: false,
          patternProperties: {
            '^x-': { type: 'string' },
          },
          dependentRequired: {
            customerType: ['tckn'],
          },
          dependentSchemas: {
            premium: {
              type: 'object',
              properties: { tier: { type: 'string', const: 'gold' } },
            },
          },
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              pattern: '^[A-Z][a-z]+$',
              format: 'email',
            },
            age: {
              type: 'integer',
              minimum: 0,
              maximum: 120,
              exclusiveMinimum: -1,
              multipleOf: 1,
            },
            tags: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
              uniqueItems: true,
              items: { type: 'string', minLength: 1 },
              prefixItems: [{ const: 'primary' }, { type: 'string' }],
              contains: { type: 'string', const: 'required-marker' },
            },
          },
        },
      },
    };

    loadFixture(original);

    // Touch an unrelated mutation (add prop) to make sure constraint
    // keywords passthrough unchanged.
    useSchemaEditorStore.getState().updateComponent(addProp('', 'extra', { type: 'boolean' }));

    const after = dump();
    const schema = (after.attributes as { schema: Record<string, unknown> }).schema;

    expect(schema.minProperties).toBe(1);
    expect(schema.maxProperties).toBe(12);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.patternProperties).toEqual({ '^x-': { type: 'string' } });
    expect(schema.dependentRequired).toEqual({ customerType: ['tckn'] });
    expect(schema.dependentSchemas).toEqual(original.attributes.schema.dependentSchemas);

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.name).toEqual(original.attributes.schema.properties.name);
    expect(props.age).toEqual(original.attributes.schema.properties.age);
    expect(props.tags).toEqual(original.attributes.schema.properties.tags);
    expect(props.extra).toEqual({ type: 'boolean' });
  });

  it('Phase 3: drag-and-drop reorder via movePropToIndex preserves bodies', () => {
    loadFixture({
      attributes: {
        schema: {
          type: 'object',
          properties: {
            alpha: { type: 'string', minLength: 1 },
            beta: { type: 'number', minimum: 0 },
            gamma: { type: 'boolean' },
          },
        },
      },
    });

    useSchemaEditorStore.getState().updateComponent(movePropToIndex('', 'alpha', 2));

    const schema = (dump().attributes as { schema: Record<string, unknown> }).schema;
    expect(Object.keys(schema.properties as object)).toEqual(['beta', 'gamma', 'alpha']);

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.alpha).toEqual({ type: 'string', minLength: 1 });
    expect(props.beta).toEqual({ type: 'number', minimum: 0 });
  });

  it('Phase 3: additionalProperties tri-state survives roundtrip in each shape', () => {
    const cases: unknown[] = [false, true, { type: 'string' }];

    for (const value of cases) {
      loadFixture({
        attributes: {
          schema: {
            type: 'object',
            additionalProperties: value,
            properties: { keep: { type: 'string' } },
          },
        },
      });

      useSchemaEditorStore.getState().updateComponent(setKeyword('', 'minProperties', 1));
      const schema = (dump().attributes as { schema: Record<string, unknown> }).schema;
      expect(schema.additionalProperties).toEqual(value);
      expect(schema.minProperties).toBe(1);
    }
  });
});
