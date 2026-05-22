import { describe, expect, it } from 'vitest';
import { produce } from 'immer';

import {
  appendPointer,
  buildPointer,
  decodeSegment,
  encodeSegment,
  getAt,
  lastSegment,
  parentPointer,
  parsePointer,
  resolveOrAncestor,
  ROOT_POINTER,
  updateAt,
} from './jsonPointer';

describe('jsonPointer', () => {
  describe('encode/decode segments', () => {
    it('escapes ~ as ~0 and / as ~1', () => {
      expect(encodeSegment('a/b')).toBe('a~1b');
      expect(encodeSegment('a~b')).toBe('a~0b');
      expect(encodeSegment('a~/b')).toBe('a~0~1b');
    });

    it('decodes ~1 to / and ~0 to ~ (order matters)', () => {
      expect(decodeSegment('a~1b')).toBe('a/b');
      expect(decodeSegment('a~0b')).toBe('a~b');
      expect(decodeSegment('a~01b')).toBe('a~1b');
    });
  });

  describe('parsePointer / buildPointer', () => {
    it('treats empty string as the root', () => {
      expect(parsePointer('')).toEqual([]);
      expect(buildPointer([])).toBe('');
    });

    it('roundtrips simple paths', () => {
      expect(parsePointer('/properties/foo')).toEqual(['properties', 'foo']);
      expect(buildPointer(['properties', 'foo'])).toBe('/properties/foo');
    });

    it('roundtrips paths containing escape characters', () => {
      const segments = ['x-field/with-slash', 'tilde~name'];
      const pointer = buildPointer(segments);
      expect(pointer).toBe('/x-field~1with-slash/tilde~0name');
      expect(parsePointer(pointer)).toEqual(segments);
    });

    it('rejects pointers that do not start with /', () => {
      expect(() => parsePointer('properties/foo')).toThrow(/must start with/);
    });
  });

  describe('appendPointer / parentPointer / lastSegment', () => {
    it('appends to root and existing pointers', () => {
      expect(appendPointer(ROOT_POINTER, 'properties')).toBe('/properties');
      expect(appendPointer('/properties', 'foo')).toBe('/properties/foo');
      expect(appendPointer('/allOf', 0, 'type')).toBe('/allOf/0/type');
    });

    it('returns null parent for the root', () => {
      expect(parentPointer('')).toBeNull();
    });

    it('returns the root as parent of a single-segment pointer', () => {
      expect(parentPointer('/properties')).toBe('');
    });

    it('returns the deepest segment decoded', () => {
      expect(lastSegment('/properties/x-field~1with-slash')).toBe('x-field/with-slash');
      expect(lastSegment('')).toBeNull();
    });
  });

  describe('getAt', () => {
    const root = {
      properties: {
        foo: { type: 'string' },
      },
      allOf: [{ const: 'a' }, { const: 'b' }],
    };

    it('reads root', () => {
      expect(getAt(root, '')).toBe(root);
    });

    it('reads nested values via object keys', () => {
      expect(getAt(root, '/properties/foo/type')).toBe('string');
    });

    it('reads array members via numeric segments', () => {
      expect(getAt(root, '/allOf/1/const')).toBe('b');
    });

    it('returns undefined for unresolvable paths', () => {
      expect(getAt(root, '/properties/missing')).toBeUndefined();
      expect(getAt(root, '/allOf/99')).toBeUndefined();
    });
  });

  describe('updateAt', () => {
    it('mutates the value at a nested object key', () => {
      const original: Record<string, unknown> = {
        properties: { foo: { type: 'string' } },
      };

      const next = produce(original, (draft) => {
        updateAt(draft, '/properties/foo', (_, container, key) => {
          (container as Record<string, unknown>)[key as string] = { type: 'number' };
        });
      });

      expect(next).toEqual({ properties: { foo: { type: 'number' } } });
      // Immer must keep the original untouched
      expect(original.properties).toEqual({ foo: { type: 'string' } });
    });

    it('mutates the value at an array index', () => {
      const original: Record<string, unknown> = { allOf: [{ a: 1 }, { a: 2 }] };

      const next = produce(original, (draft) => {
        updateAt(draft, '/allOf/0', (_, container, key) => {
          (container as unknown[])[key as number] = { a: 99 };
        });
      });

      expect(next.allOf).toEqual([{ a: 99 }, { a: 2 }]);
    });

    it('returns false when the path cannot be resolved', () => {
      let visited = false;
      const original: Record<string, unknown> = { properties: {} };

      produce(original, (draft) => {
        const ok = updateAt(draft, '/properties/missing/type', () => {
          visited = true;
        });

        expect(ok).toBe(false);
      });

      expect(visited).toBe(false);
    });

    it('returns false at root (root mutations are not supported here)', () => {
      const original: Record<string, unknown> = {};

      produce(original, (draft) => {
        expect(updateAt(draft, '', () => {})).toBe(false);
      });
    });
  });

  describe('resolveOrAncestor', () => {
    const root = { properties: { foo: { allOf: [{ type: 'string' }] } } };

    it('returns the pointer if resolvable', () => {
      expect(resolveOrAncestor(root, '/properties/foo/allOf/0')).toBe('/properties/foo/allOf/0');
    });

    it('walks up to the closest resolvable ancestor', () => {
      expect(resolveOrAncestor(root, '/properties/foo/allOf/99/type')).toBe('/properties/foo/allOf');
    });

    it('falls back to the root if nothing along the path resolves', () => {
      expect(resolveOrAncestor(root, '/properties/missing/items/0')).toBe('/properties');
    });
  });
});
