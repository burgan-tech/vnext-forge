import { describe, expect, it } from 'vitest';

import { jsonPointerToNodePath, nodePathToJsonPointer } from './jsonPointerPath';

describe('jsonPointerPath', () => {
  describe('nodePathToJsonPointer', () => {
    it('renders the root path as /view', () => {
      expect(nodePathToJsonPointer([])).toBe('/view');
    });

    it('inserts implicit /children/ for top-level numeric segments', () => {
      expect(nodePathToJsonPointer([0])).toBe('/view/children/0');
      expect(nodePathToJsonPointer([0, 2])).toBe('/view/children/0/children/2');
    });

    it('emits ForEach template slot directly', () => {
      expect(nodePathToJsonPointer([0, 'template'])).toBe('/view/children/0/template');
    });

    it('emits TabView tabs/i/content/j without implicit children', () => {
      expect(nodePathToJsonPointer([0, 'tabs', 0, 'content', 1])).toBe(
        '/view/children/0/tabs/0/content/1',
      );
    });

    it('emits Stepper steps/i/content/j', () => {
      expect(nodePathToJsonPointer([0, 'steps', 0, 'content', 1])).toBe(
        '/view/children/0/steps/0/content/1',
      );
    });
  });

  describe('jsonPointerToNodePath', () => {
    it('parses /view as root []', () => {
      expect(jsonPointerToNodePath('/view')).toEqual([]);
    });

    it('parses /view/children/N as [N]', () => {
      expect(jsonPointerToNodePath('/view/children/0')).toEqual([0]);
      expect(jsonPointerToNodePath('/view/children/0/children/2')).toEqual([0, 2]);
    });

    it('parses ForEach template slot', () => {
      expect(jsonPointerToNodePath('/view/children/0/template')).toEqual([0, 'template']);
    });

    it('parses TabView tabs/i/content/j', () => {
      expect(jsonPointerToNodePath('/view/children/0/tabs/0/content/1')).toEqual([
        0,
        'tabs',
        0,
        'content',
        1,
      ]);
    });

    it('parses Stepper steps/i/content/j', () => {
      expect(jsonPointerToNodePath('/view/children/0/steps/0/content/1')).toEqual([
        0,
        'steps',
        0,
        'content',
        1,
      ]);
    });

    it('returns null for unsupported slot keys', () => {
      expect(jsonPointerToNodePath('/view/children/0/actions/1')).toBeNull();
      expect(jsonPointerToNodePath('/view/children/0/leading')).toBeNull();
      expect(jsonPointerToNodePath('/view/children/0/header')).toBeNull();
    });

    it('returns null for malformed pointers', () => {
      expect(jsonPointerToNodePath('children/0')).toBeNull();
      expect(jsonPointerToNodePath('/other/0')).toBeNull();
      expect(jsonPointerToNodePath('/view/0')).toBeNull();
      expect(jsonPointerToNodePath('')).toBeNull();
    });
  });

  describe('round-trip', () => {
    const cases: Array<readonly (string | number)[]> = [
      [],
      [0],
      [3, 1, 0],
      [0, 'template'],
      [0, 'tabs', 0, 'content', 1],
      [0, 'steps', 2, 'content', 0],
      [0, 'template', 1, 'tabs', 0, 'content', 0],
    ];
    for (const path of cases) {
      it(`survives round-trip for ${JSON.stringify(path)}`, () => {
        const pointer = nodePathToJsonPointer(path);
        const back = jsonPointerToNodePath(pointer);
        expect(back).toEqual(path);
      });
    }
  });
});
