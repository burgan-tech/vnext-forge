import { describe, expect, it } from 'vitest';

import type { BuilderNode, NodePath } from '../types';
import { collectChildren, walkAll } from './OutlinePanel';

const text: BuilderNode = { type: 'Text', content: { en: 'hi' } };
const scaffold: BuilderNode = {
  type: 'Scaffold',
  body: { type: 'Column', children: [text] },
};

describe('OutlinePanel — Scaffold slots', () => {
  it('collectChildren lists the Scaffold body', () => {
    const kids = collectChildren(scaffold, []);
    expect(kids.map((k) => k.path)).toEqual([['body']]);
    expect(kids[0].node.type).toBe('Column');
  });

  it('walkAll reaches nodes inside Scaffold.body.children', () => {
    const paths: NodePath[] = [];
    walkAll(scaffold, [], (_n, p) => paths.push(p));
    expect(paths).toEqual([[], ['body'], ['body', 0]]);
  });
});
