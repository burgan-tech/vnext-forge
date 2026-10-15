import { describe, expect, it } from 'vitest';

import { fieldHelpText, orderedPropertyEntries } from './presentationHints';

describe('orderedPropertyEntries', () => {
  it('sorts by x-order and keeps unordered fields after, in their order', () => {
    const keys = orderedPropertyEntries({
      a: {},
      city: { 'x-order': 3 },
      b: {},
      first: { 'x-order': 1 },
      last: { 'x-order': 2 },
    }).map(([key]) => key);
    expect(keys).toEqual(['first', 'last', 'city', 'a', 'b']);
  });
});

describe('fieldHelpText', () => {
  it('prefers description, then English help text, then any', () => {
    expect(fieldHelpText({ description: 'd', 'x-helpText': { en: 'h' } })).toBe('d');
    expect(fieldHelpText({ 'x-helpText': { tr: 'yardım', en: 'help' } })).toBe('help');
    expect(fieldHelpText({ 'x-helpText': { tr: 'yardım' } })).toBe('yardım');
    expect(fieldHelpText({})).toBeUndefined();
  });
});
