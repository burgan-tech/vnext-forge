import { describe, expect, it } from 'vitest';

import { deriveTaskStateKey, shouldPersistCacheAsideSourceMapping } from './taskScriptPersistence.js';

describe('deriveTaskStateKey', () => {
  it('returns the task json key when it is a non-empty string', () => {
    expect(deriveTaskStateKey({ key: 'my-cache-aside-task' })).toBe('my-cache-aside-task');
  });

  it('falls back to "task" when key is missing, empty, or not a string', () => {
    expect(deriveTaskStateKey(null)).toBe('task');
    expect(deriveTaskStateKey(undefined)).toBe('task');
    expect(deriveTaskStateKey({})).toBe('task');
    expect(deriveTaskStateKey({ key: '' })).toBe('task');
    expect(deriveTaskStateKey({ key: 42 })).toBe('task');
  });
});

describe('shouldPersistCacheAsideSourceMapping', () => {
  const baseScript = {
    listField: 'attributes',
    scriptField: 'config.sourceMapping',
    stateKey: 'task-a',
  };

  it('persists when the script belongs to the currently loaded task', () => {
    expect(shouldPersistCacheAsideSourceMapping(baseScript, 'task-a')).toBe(true);
  });

  it('REGRESSION (cross-task clobber): rejects a script left open from a different task', () => {
    // Task A's Source Mapping panel is still open (global store) after the
    // user navigates to Task B without closing it. Task B's currentTaskStateKey
    // ('task-b') must not match Task A's script.stateKey ('task-a').
    expect(shouldPersistCacheAsideSourceMapping(baseScript, 'task-b')).toBe(false);
  });

  it('rejects scripts for a different listField (e.g. a workflow onEntry/onExit script)', () => {
    expect(
      shouldPersistCacheAsideSourceMapping(
        { ...baseScript, listField: 'onEntries' },
        'task-a',
      ),
    ).toBe(false);
  });

  it('rejects scripts for a different scriptField (e.g. a function task mapping)', () => {
    expect(
      shouldPersistCacheAsideSourceMapping(
        { ...baseScript, scriptField: 'task.mapping' },
        'task-a',
      ),
    ).toBe(false);
  });
});
