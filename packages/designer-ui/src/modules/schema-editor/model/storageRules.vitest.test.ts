import { describe, expect, it } from 'vitest';

import { fileHandleShape, storageIssues, storageLocationIssue } from './storageRules';

const doc = (schema: Record<string, unknown>) => ({ attributes: { type: 'master', schema } });
const file = (extra: Record<string, unknown> = {}) => ({ type: 'object', 'x-storage': { binding: 'vnext-blob-local' }, ...extra });

describe('storageLocationIssue', () => {
  const root = {
    type: 'object',
    properties: {
      doc: file(),
      files: { type: 'array', items: file() },
      nested: { type: 'array', items: { type: 'array', items: file() } },
      outer: { ...file(), properties: { inner: file() } },
    },
    $defs: { d: file() },
  };

  it('accepts nested properties and one array level', () => {
    expect(storageLocationIssue(root, '/properties/doc')).toBeNull();
    expect(storageLocationIssue(root, '/properties/files/items')).toBeNull();
  });

  it('refuses root, $defs, nested arrays and nested file nodes', () => {
    expect(storageLocationIssue(root, '')).toContain('root');
    expect(storageLocationIssue(root, '/$defs/d')).toContain('$defs');
    expect(storageLocationIssue(root, '/properties/nested/items/items')).toContain('nested arrays');
    expect(storageLocationIssue(root, '/properties/outer/properties/inner')).toContain('another file field');
  });
});

describe('storageIssues', () => {
  it('accepts the documented handle shape', () => {
    expect(storageIssues(doc({ type: 'object', properties: { doc: { ...fileHandleShape(), 'x-storage': { binding: 'b' } } } }), '/properties/doc')).toEqual([]);
  });

  it('refuses a non-object node, declared content and a missing binding', () => {
    const json = doc({
      type: 'object',
      properties: {
        doc: { type: 'string', 'x-storage': {} },
        up: file({ properties: { content: { type: 'string' } }, required: ['content'] }),
      },
    });
    const docIssues = storageIssues(json, '/properties/doc');
    expect(docIssues.some((i) => i.includes('type "object"'))).toBe(true);
    expect(docIssues.some((i) => i.includes('needs a binding'))).toBe(true);
    expect(storageIssues(json, '/properties/up').some((i) => i.includes('never carries content'))).toBe(true);
  });
});
