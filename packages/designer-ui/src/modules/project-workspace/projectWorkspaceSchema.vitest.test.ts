import { describe, expect, it } from 'vitest';

import { ensureComponentJsonFileName } from './ProjectWorkspaceSchema.js';

describe('ensureComponentJsonFileName', () => {
  it('adds .json when missing', () => {
    expect(ensureComponentJsonFileName('foo')).toBe('foo.json');
  });

  it('does not double .json', () => {
    expect(ensureComponentJsonFileName('foo.json')).toBe('foo.json');
    expect(ensureComponentJsonFileName('foo.JSON')).toBe('foo.json');
  });

  it('returns null for empty base', () => {
    expect(ensureComponentJsonFileName('')).toBeNull();
    expect(ensureComponentJsonFileName('   ')).toBeNull();
    expect(ensureComponentJsonFileName('.json')).toBeNull();
  });
});
