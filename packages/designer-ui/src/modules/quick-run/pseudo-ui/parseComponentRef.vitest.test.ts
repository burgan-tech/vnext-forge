import { describe, expect, it } from 'vitest';

import { parseComponentRef } from './parseComponentRef';

describe('parseComponentRef (R25.B-3)', () => {
  it('returns null for nullish / empty input', () => {
    expect(parseComponentRef(null)).toBeNull();
    expect(parseComponentRef(undefined)).toBeNull();
    expect(parseComponentRef('')).toBeNull();
    expect(parseComponentRef('   ')).toBeNull();
  });

  it('parses an Amorphie component URN', () => {
    expect(parseComponentRef('urn:amorphie:res:component:core:branch-selection')).toEqual({
      key: 'branch-selection',
      domain: 'core',
    });
  });

  it('ignores trailing version segment in the URN', () => {
    expect(parseComponentRef('urn:amorphie:res:component:core:branch-selection:1.0.0')).toEqual({
      key: 'branch-selection',
      domain: 'core',
    });
  });

  it('rejects URNs with the wrong resource type segment', () => {
    expect(parseComponentRef('urn:amorphie:res:schema:core:branch-selection')).toBeNull();
  });

  it('parses an https URL with a .json suffix', () => {
    expect(parseComponentRef('https://components.vnext.com/core/branch-selection.json')).toEqual({
      key: 'branch-selection',
      domain: 'core',
    });
  });

  it('parses an https URL without .json suffix', () => {
    expect(parseComponentRef('https://components.example/core/branch-selection')).toEqual({
      key: 'branch-selection',
      domain: 'core',
    });
  });

  it('returns the bare key for non-URN, non-URL strings', () => {
    expect(parseComponentRef('branch-selection')).toEqual({ key: 'branch-selection' });
    expect(parseComponentRef('  some-key  ')).toEqual({ key: 'some-key' });
  });
});
