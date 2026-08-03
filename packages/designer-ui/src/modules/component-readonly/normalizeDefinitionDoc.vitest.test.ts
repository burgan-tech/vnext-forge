import { describe, expect, it } from 'vitest';

import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';

describe('normalizeDefinitionDoc', () => {
  it('passes through an attributes-nested document unchanged', () => {
    const doc = {
      key: 't1', version: '1.0.0', domain: 'core', flow: 'sys-tasks',
      attributes: { type: '6', config: { url: 'https://x' } },
    };
    expect(normalizeDefinitionDoc('task', doc)).toEqual(doc);
  });

  it('lifts flattened monitor-API fields into attributes', () => {
    const flat = {
      key: 't1', version: '1.0.0', domain: 'core', flow: 'sys-tasks',
      type: '6', config: { url: 'https://x' }, tags: ['a'],
    };
    const doc = normalizeDefinitionDoc('task', flat);
    expect((doc.attributes as Record<string, unknown>).type).toBe('6');
    expect((doc.attributes as Record<string, unknown>).config).toEqual({ url: 'https://x' });
    expect(doc.key).toBe('t1');
    expect(doc.tags).toEqual(['a']);
    expect(doc).not.toHaveProperty('config'); // moved, not duplicated
  });

  it('normalizes a flattened view', () => {
    const doc = normalizeDefinitionDoc('view', {
      key: 'v1', type: 2, display: 'full-page', renderer: '', content: '<b>x</b>',
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.type).toBe(2);
    expect(attrs.display).toBe('full-page');
    expect(attrs.content).toBe('<b>x</b>');
  });

  it('normalizes a flattened mapping with script alias', () => {
    const doc = normalizeDefinitionDoc('mapping', {
      key: 'm1', name: 'Helper', script: 'cHVibGlj', encoding: 'B64', location: './src/x.csx',
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.code).toBe('cHVibGlj');
    expect(attrs.encoding).toBe('B64');
    expect(attrs.name).toBe('Helper');
  });

  it('normalizes a flattened schema payload', () => {
    const doc = normalizeDefinitionDoc('schema', {
      key: 's1', schema: { type: 'object', properties: { a: { type: 'string' } } },
    });
    expect((doc.attributes as Record<string, unknown>).schema).toEqual({
      type: 'object', properties: { a: { type: 'string' } },
    });
  });

  it('normalizes a flattened extension', () => {
    const doc = normalizeDefinitionDoc('extension', {
      key: 'e1', type: 3, scope: 3, definedFlows: ['wf-a'],
      task: { order: 1, task: { key: 't' } },
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.type).toBe(3);
    expect(attrs.scope).toBe(3);
    expect(attrs.definedFlows).toEqual(['wf-a']);
    expect(attrs.task).toEqual({ order: 1, task: { key: 't' } });
    expect(doc.key).toBe('e1');
    expect(doc).not.toHaveProperty('type');
    expect(doc).not.toHaveProperty('scope');
    expect(doc).not.toHaveProperty('definedFlows');
    expect(doc).not.toHaveProperty('task');
  });

  it('normalizes a flattened function', () => {
    const doc = normalizeDefinitionDoc('function', {
      key: 'f1', scope: 'D',
      onExecutionTasks: [{ order: 1, task: { key: 't' } }],
      output: { code: 'abc', encoding: 'B64' },
      rawResponse: true,
      cache: { key: 'c' },
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.scope).toBe('D');
    expect(attrs.onExecutionTasks).toEqual([{ order: 1, task: { key: 't' } }]);
    expect(attrs.output).toEqual({ code: 'abc', encoding: 'B64' });
    expect(attrs.rawResponse).toBe(true);
    expect(attrs.cache).toEqual({ key: 'c' });
    expect(doc.key).toBe('f1');
    expect(doc).not.toHaveProperty('scope');
    expect(doc).not.toHaveProperty('rawResponse');
  });

  it('routes labels into attributes for a view but keeps them top-level elsewhere', () => {
    const view = normalizeDefinitionDoc('view', {
      key: 'v1', type: 1, labels: [{ label: 'Title', language: 'en' }],
    });
    expect((view.attributes as Record<string, unknown>).labels).toEqual([
      { label: 'Title', language: 'en' },
    ]);
    expect(view).not.toHaveProperty('labels');

    const task = normalizeDefinitionDoc('task', {
      key: 't1', type: '6', labels: [{ label: 'Title', language: 'en' }],
    });
    expect(task.labels).toEqual([{ label: 'Title', language: 'en' }]);
    expect((task.attributes as Record<string, unknown>).labels).toBeUndefined();
  });

  it('returns an empty attributes bag for an empty document', () => {
    expect(normalizeDefinitionDoc('task', {})).toEqual({ attributes: {} });
  });

  it('treats a null attributes field as flattened (typeof null === "object")', () => {
    const doc = normalizeDefinitionDoc('task', {
      key: 't1', attributes: null, type: '7', config: { language: 'csharp' },
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.type).toBe('7');
    expect(attrs.config).toEqual({ language: 'csharp' });
    expect(doc.attributes).not.toBeNull();
  });
});
