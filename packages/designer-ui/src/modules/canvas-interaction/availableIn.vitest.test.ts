import { describe, expect, it } from 'vitest';

import {
  availableInStateKeys,
  formatAvailableIn,
  parseAvailableIn,
  serializeAvailableIn,
  type AvailableInEntry,
} from '@vnext-forge-studio/vnext-types';

/**
 * The `availableIn` codec lives in `vnext-types` (the dependency-policy leaf
 * every consumer already depends on), but that package has no test runner and
 * never has had one. Its tests live here instead — designer-ui is the primary
 * consumer, already on vitest, and already hosts the other canvas tests — the
 * same arrangement as `view-editor/viewDisplay.vitest.test.ts`.
 */
describe('parseAvailableIn', () => {
  it('reads the bare string form as a role-less entry', () => {
    expect(parseAvailableIn(['review'])).toEqual([{ state: 'review' }]);
  });

  it('reads the object form, keeping role grants', () => {
    expect(
      parseAvailableIn([{ state: 'approval', roles: [{ role: 'supervisor', grant: 'allow' }] }]),
    ).toEqual([{ state: 'approval', roles: [{ role: 'supervisor', grant: 'allow' }] }]);
  });

  it('reads the two forms mixed in one array, preserving order', () => {
    expect(
      parseAvailableIn(['review', { state: 'approval', roles: [{ role: 'x', grant: 'deny' }] }]),
    ).toEqual([
      { state: 'review' },
      { state: 'approval', roles: [{ role: 'x', grant: 'deny' }] },
    ]);
  });

  it('treats an object without roles as identical to the bare string', () => {
    expect(parseAvailableIn([{ state: 'review' }])).toEqual(parseAvailableIn(['review']));
  });

  it('drops an empty roles array rather than carrying it through', () => {
    expect(parseAvailableIn([{ state: 'review', roles: [] }])).toEqual([{ state: 'review' }]);
  });

  it('skips items it cannot read instead of throwing', () => {
    expect(parseAvailableIn(['ok', '', '   ', 42, null, {}, { state: '' }, ['nested']])).toEqual([
      { state: 'ok' },
    ]);
  });

  it('reads a non-array as an empty list', () => {
    expect(parseAvailableIn(undefined)).toEqual([]);
    expect(parseAvailableIn(null)).toEqual([]);
    expect(parseAvailableIn('review')).toEqual([]);
  });
});

describe('serializeAvailableIn', () => {
  it('writes a role-less entry back as a bare string', () => {
    expect(serializeAvailableIn([{ state: 'review' }])).toEqual(['review']);
  });

  it('writes an entry with an empty roles array back as a bare string', () => {
    expect(serializeAvailableIn([{ state: 'review', roles: [] }])).toEqual(['review']);
  });

  it('writes an entry with grants back as an object', () => {
    expect(
      serializeAvailableIn([{ state: 'approval', roles: [{ role: 'x', grant: 'allow' }] }]),
    ).toEqual([{ state: 'approval', roles: [{ role: 'x', grant: 'allow' }] }]);
  });

  it('returns undefined for an empty list so the caller drops the key', () => {
    expect(serializeAvailableIn([])).toBeUndefined();
  });

  it('round-trips an existing plain array untouched', () => {
    const authored = ['review', 'approval'];
    expect(serializeAvailableIn(parseAvailableIn(authored))).toEqual(authored);
  });

  it('round-trips a mixed array untouched', () => {
    const authored = [
      'review',
      { state: 'approval', roles: [{ role: 'supervisor', grant: 'allow' as const }] },
    ];
    expect(serializeAvailableIn(parseAvailableIn(authored))).toEqual(authored);
  });

  it('collapses a role-less object back to a string, matching the runtime', () => {
    expect(serializeAvailableIn(parseAvailableIn([{ state: 'review' }]))).toEqual(['review']);
  });
});

describe('availableInStateKeys', () => {
  it('returns keys from both forms in authored order', () => {
    expect(
      availableInStateKeys([
        'review',
        { state: 'approval', roles: [{ role: 'x', grant: 'allow' }] },
      ]),
    ).toEqual(['review', 'approval']);
  });

  it('returns an empty array for an absent value', () => {
    expect(availableInStateKeys(undefined)).toEqual([]);
  });
});

describe('formatAvailableIn', () => {
  it('lists bare states plainly', () => {
    expect(formatAvailableIn(['review', 'approval'])).toBe('review, approval');
  });

  it('annotates role-scoped states with their grant count', () => {
    expect(
      formatAvailableIn([
        'review',
        {
          state: 'approval',
          roles: [
            { role: 'a', grant: 'allow' },
            { role: 'b', grant: 'deny' },
          ],
        },
      ]),
    ).toBe('review, approval (2 roles)');
  });

  it('uses the singular for a single grant', () => {
    expect(formatAvailableIn([{ state: 'approval', roles: [{ role: 'a', grant: 'allow' }] }])).toBe(
      'approval (1 role)',
    );
  });

  it('falls back to the empty text when nothing is declared', () => {
    expect(formatAvailableIn(undefined)).toBe('—');
    expect(formatAvailableIn([], 'every state')).toBe('every state');
  });
});

describe('editor mutation flow', () => {
  /** Mirrors what `AvailableInEditor` does when the state selection changes. */
  function setStates(current: unknown, keys: string[]) {
    const byState = new Map(parseAvailableIn(current).map((e) => [e.state, e]));
    const next: AvailableInEntry[] = keys.map((key) => byState.get(key) ?? { state: key });
    return serializeAvailableIn(next);
  }

  it('keeps the roles of a state that stays selected', () => {
    const authored = [{ state: 'approval', roles: [{ role: 'x', grant: 'allow' as const }] }];
    expect(setStates(authored, ['approval', 'review'])).toEqual([
      { state: 'approval', roles: [{ role: 'x', grant: 'allow' }] },
      'review',
    ]);
  });

  it('drops the roles of a state that is deselected', () => {
    const authored = [{ state: 'approval', roles: [{ role: 'x', grant: 'allow' as const }] }];
    expect(setStates(authored, ['review'])).toEqual(['review']);
  });

  it('yields undefined once every state is deselected', () => {
    expect(setStates(['review'], [])).toBeUndefined();
  });
});
