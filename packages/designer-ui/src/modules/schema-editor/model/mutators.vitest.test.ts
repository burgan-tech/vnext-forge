import { describe, expect, it } from 'vitest';
import { produce } from 'immer';

import {
  addCompositionItem,
  addProp,
  moveCompositionItem,
  moveProp,
  movePropToIndex,
  removeCompositionItem,
  removeProp,
  renameProp,
  setKeyword,
  setRequired,
  setType,
  toggleNot,
  toggleVNextKey,
  type SchemaUpdater,
} from './mutators';

function emptyDoc(schema: Record<string, unknown> = {}): Record<string, unknown> {
  return { key: 'x', version: '1.0.0', domain: 'd', attributes: { schema } };
}

function apply(doc: Record<string, unknown>, updater: SchemaUpdater): Record<string, unknown> {
  return produce(doc, updater);
}

function getSchema(doc: Record<string, unknown>): Record<string, unknown> {
  return (doc.attributes as Record<string, unknown>).schema as Record<string, unknown>;
}

describe('mutators', () => {
  describe('addProp / removeProp', () => {
    it('adds a property under the root schema with a default type', () => {
      const next = apply(emptyDoc({ type: 'object' }), addProp('', 'foo'));
      expect(getSchema(next)).toEqual({ type: 'object', properties: { foo: { type: 'string' } } });
    });

    it('creates the properties container if missing', () => {
      const next = apply(emptyDoc(), addProp('', 'bar', { type: 'number' }));
      expect(getSchema(next).properties).toEqual({ bar: { type: 'number' } });
    });

    it('is a no-op when the key already exists', () => {
      const start = emptyDoc({ properties: { foo: { type: 'string' } } });
      const next = apply(start, addProp('', 'foo'));
      expect(next).toEqual(start);
    });

    it('adds nested under a property pointer', () => {
      const start = emptyDoc({
        properties: { parent: { type: 'object', properties: {} } },
      });
      const next = apply(start, addProp('/properties/parent', 'child'));
      expect((getSchema(next).properties as Record<string, Record<string, unknown>>).parent.properties).toEqual({
        child: { type: 'string' },
      });
    });

    it('removes a property and any reference in required', () => {
      const start = emptyDoc({
        properties: { foo: { type: 'string' }, bar: { type: 'string' } },
        required: ['foo', 'bar'],
      });
      const next = apply(start, removeProp('', 'foo'));
      expect(getSchema(next).properties).toEqual({ bar: { type: 'string' } });
      expect(getSchema(next).required).toEqual(['bar']);
    });

    it('deletes empty required after removing the last key', () => {
      const start = emptyDoc({ properties: { foo: { type: 'string' } }, required: ['foo'] });
      const next = apply(start, removeProp('', 'foo'));
      expect('required' in getSchema(next)).toBe(false);
    });
  });

  describe('renameProp', () => {
    it('preserves the position of the renamed key', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
      });
      const next = apply(start, renameProp('', 'b', 'bb'));
      expect(Object.keys(getSchema(next).properties as object)).toEqual(['a', 'bb', 'c']);
    });

    it('updates the required array when the renamed key was required', () => {
      const start = emptyDoc({
        properties: { foo: { type: 'string' } },
        required: ['foo'],
      });
      const next = apply(start, renameProp('', 'foo', 'fooBar'));
      expect(getSchema(next).required).toEqual(['fooBar']);
    });

    it('is a no-op when the new key already exists', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' } },
      });
      const next = apply(start, renameProp('', 'a', 'b'));
      expect(next).toEqual(start);
    });

    it('is a no-op when the new key is empty', () => {
      const start = emptyDoc({ properties: { a: { type: 'string' } } });
      const next = apply(start, renameProp('', 'a', ''));
      expect(next).toEqual(start);
    });
  });

  describe('moveProp', () => {
    it('moves a key up by one position', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
      });
      const next = apply(start, moveProp('', 'c', -1));
      expect(Object.keys(getSchema(next).properties as object)).toEqual(['a', 'c', 'b']);
    });

    it('clamps movement at array bounds', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' } },
      });
      const next = apply(start, moveProp('', 'a', -1));
      expect(next).toEqual(start);
    });
  });

  describe('movePropToIndex', () => {
    it('moves a key to an absolute index', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
      });
      const next = apply(start, movePropToIndex('', 'a', 2));
      expect(Object.keys(getSchema(next).properties as object)).toEqual(['b', 'c', 'a']);
    });

    it('clamps out-of-range targets', () => {
      const start = emptyDoc({
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
      });
      const next = apply(start, movePropToIndex('', 'a', 99));
      expect(Object.keys(getSchema(next).properties as object)).toEqual(['b', 'c', 'a']);
    });

    it('is a no-op when the target equals the current index', () => {
      const start = emptyDoc({
        properties: { a: {}, b: {} },
      });
      const next = apply(start, movePropToIndex('', 'a', 0));
      expect(next).toEqual(start);
    });
  });

  describe('setRequired', () => {
    it('adds the key to required when missing', () => {
      const start = emptyDoc({ properties: { foo: { type: 'string' } } });
      const next = apply(start, setRequired('', 'foo', true));
      expect(getSchema(next).required).toEqual(['foo']);
    });

    it('removes the key when unset and deletes empty required', () => {
      const start = emptyDoc({ properties: { foo: { type: 'string' } }, required: ['foo'] });
      const next = apply(start, setRequired('', 'foo', false));
      expect('required' in getSchema(next)).toBe(false);
    });

    it('does not duplicate an existing required entry', () => {
      const start = emptyDoc({ properties: { foo: { type: 'string' } }, required: ['foo'] });
      const next = apply(start, setRequired('', 'foo', true));
      expect(next).toEqual(start);
    });
  });

  describe('setType', () => {
    it('sets the type and strips number-only keywords when switching to string', () => {
      const start = emptyDoc({ type: 'number', minimum: 5, maximum: 10 });
      const next = apply(start, setType('', 'string'));
      expect(getSchema(next)).toEqual({ type: 'string' });
    });

    it('strips object-only keywords when switching to array', () => {
      const start = emptyDoc({ type: 'object', properties: { foo: {} }, required: ['foo'] });
      const next = apply(start, setType('', 'array'));
      expect('properties' in getSchema(next)).toBe(false);
      expect('required' in getSchema(next)).toBe(false);
      expect(getSchema(next).type).toBe('array');
    });

    it('clears type when null is passed', () => {
      const start = emptyDoc({ type: 'string', minLength: 1 });
      const next = apply(start, setType('', null));
      expect('type' in getSchema(next)).toBe(false);
      // minLength stays — only setting a new type cleans incompatibles
      expect(getSchema(next).minLength).toBe(1);
    });
  });

  describe('setKeyword', () => {
    it('sets and removes a keyword', () => {
      const start = emptyDoc({ type: 'string' });
      const withVal = apply(start, setKeyword('', 'minLength', 3));
      expect(getSchema(withVal).minLength).toBe(3);

      const cleared = apply(withVal, setKeyword('', 'minLength', undefined));
      expect('minLength' in getSchema(cleared)).toBe(false);
    });
  });

  describe('toggleVNextKey', () => {
    it('enables with the supplied default and disables by deleting the key', () => {
      const start = emptyDoc({ type: 'string' });
      const seed = () => ({ en: 'Hello' });

      const enabled = apply(start, toggleVNextKey('', 'x-labels', seed));
      expect(getSchema(enabled)['x-labels']).toEqual({ en: 'Hello' });

      const disabled = apply(enabled, toggleVNextKey('', 'x-labels', seed));
      expect('x-labels' in getSchema(disabled)).toBe(false);
    });
  });

  describe('composition mutators', () => {
    it('addCompositionItem creates and grows the array', () => {
      const start = emptyDoc({ type: 'object' });
      const one = apply(start, addCompositionItem('', 'allOf', { type: 'string' }));
      expect(getSchema(one).allOf).toEqual([{ type: 'string' }]);

      const two = apply(one, addCompositionItem('', 'allOf', { type: 'number' }));
      expect(getSchema(two).allOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    });

    it('removeCompositionItem strips the keyword when the array empties', () => {
      const start = emptyDoc({ anyOf: [{ type: 'string' }] });
      const next = apply(start, removeCompositionItem('', 'anyOf', 0));
      expect('anyOf' in getSchema(next)).toBe(false);
    });

    it('moveCompositionItem reorders within bounds', () => {
      const start = emptyDoc({ oneOf: [{ a: 1 }, { a: 2 }, { a: 3 }] });
      const next = apply(start, moveCompositionItem('', 'oneOf', 0, 2));
      expect(getSchema(next).oneOf).toEqual([{ a: 2 }, { a: 3 }, { a: 1 }]);
    });

    it('toggleNot installs a fresh subschema and removes it on second toggle', () => {
      const start = emptyDoc({ type: 'object' });
      const on = apply(start, toggleNot(''));
      expect(getSchema(on).not).toEqual({});

      const off = apply(on, toggleNot(''));
      expect('not' in getSchema(off)).toBe(false);
    });
  });

  describe('deeply nested operations', () => {
    it('addProp under properties.foo.items.allOf[0]', () => {
      const start = emptyDoc({
        properties: {
          foo: {
            type: 'array',
            items: {
              allOf: [{ type: 'object', properties: {} }],
            },
          },
        },
      });

      const next = apply(start, addProp('/properties/foo/items/allOf/0', 'inner', { type: 'integer' }));
      const innerNode = (getSchema(next) as any).properties.foo.items.allOf[0].properties.inner;
      expect(innerNode).toEqual({ type: 'integer' });
    });
  });
});
