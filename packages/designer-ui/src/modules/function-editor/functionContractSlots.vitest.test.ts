/**
 * The function contract slots accept three interchangeable wire shapes
 * per slot, and the editor must round-trip all of them without losing
 * user data. These tests pin the read/normalize/write invariants that
 * the UI depends on — they are the reason the shaping logic lives in
 * pure functions rather than inline in the components.
 */
import { describe, expect, it } from 'vitest';

import {
  emptyComponentRef,
  entriesFromSingle,
  findShadowingFallbackIndex,
  isComponentFileRef,
  isEmptyComponentRef,
  normalizeVerbs,
  readSlot,
  readVerbs,
  refFromDiscoveredComponent,
  singleFromEntries,
  toggleVerb,
  writeSlotEntries,
  writeSlotSingle,
  type SlotRuleEntry,
} from './functionContractSlots';

const VIEW_REF = { key: 'approve-form', domain: 'lending', version: '1.0.0', flow: 'sys-views' };
const SCHEMA_REF = { key: 'approve-input', domain: 'lending', version: '2.1.0', flow: 'sys-schemas' };
const RULE = { location: './src/Rule.csx', code: 'Ly8=', encoding: 'B64' as const };

describe('readSlot — the three wire shapes', () => {
  it('reads a bare reference as single mode', () => {
    const state = readSlot('view', VIEW_REF);
    expect(state).toEqual({ mode: 'single', ref: VIEW_REF, entries: [], unrecognized: false });
  });

  it('reads a flat rule-entry array as rule-based mode', () => {
    const state = readSlot('view', [{ rule: RULE, view: VIEW_REF, loadData: true }, { view: VIEW_REF }]);
    expect(state.mode).toBe('rule-based');
    expect(state.entries).toEqual([
      { rule: RULE, ref: VIEW_REF, loadData: true },
      { ref: VIEW_REF },
    ]);
  });

  it('reads the { views: [...] } wrapper as rule-based mode', () => {
    const state = readSlot('view', { views: [{ view: VIEW_REF }] });
    expect(state.mode).toBe('rule-based');
    expect(state.entries).toEqual([{ ref: VIEW_REF }]);
  });

  it('reads the { schemas: [...] } wrapper for schema slots', () => {
    const state = readSlot('schema', { schemas: [{ rule: RULE, schema: SCHEMA_REF }] });
    expect(state.mode).toBe('rule-based');
    expect(state.entries).toEqual([{ rule: RULE, ref: SCHEMA_REF }]);
  });

  it('reads the { ref: "./file.json" } reference form', () => {
    const state = readSlot('view', { ref: './views/approve.json' });
    expect(state.mode).toBe('single');
    expect(state.ref).toEqual({ ref: './views/approve.json' });
    expect(state.unrecognized).toBe(false);
  });

  it('treats a missing slot as empty single mode, not unrecognized', () => {
    for (const value of [undefined, null]) {
      const state = readSlot('view', value);
      expect(state).toEqual({ mode: 'single', ref: null, entries: [], unrecognized: false });
    }
  });

  it('flags a value matching none of the wire shapes as unrecognized', () => {
    // The UI must then refuse to rewrite the slot so nothing is lost.
    for (const value of ['a string', 42, { nonsense: true }]) {
      expect(readSlot('view', value).unrecognized).toBe(true);
    }
  });

  it('does not read a view wrapper as a schema slot, or vice versa', () => {
    expect(readSlot('schema', { views: [{ view: VIEW_REF }] }).unrecognized).toBe(true);
    expect(readSlot('view', { schemas: [{ schema: SCHEMA_REF }] }).unrecognized).toBe(true);
  });

  it('ignores loadData on schema entries — the contract has no such field', () => {
    const state = readSlot('schema', [{ schema: SCHEMA_REF, loadData: true }]);
    expect(state.entries).toEqual([{ ref: SCHEMA_REF }]);
  });

  it('keeps an entry whose reference is missing so the UI can prompt for a pick', () => {
    const state = readSlot('view', [{ rule: RULE }]);
    expect(state.entries).toEqual([{ rule: RULE }]);
  });
});

describe('write — canonical forms and collapse-to-undefined', () => {
  it('writes single mode as a bare reference, never a wrapper', () => {
    expect(writeSlotSingle(VIEW_REF)).toEqual(VIEW_REF);
  });

  it('drops the slot when the single reference holds nothing', () => {
    expect(writeSlotSingle(null)).toBeUndefined();
    expect(writeSlotSingle(undefined)).toBeUndefined();
    expect(writeSlotSingle(emptyComponentRef('view'))).toBeUndefined();
    expect(writeSlotSingle({ ref: '   ' })).toBeUndefined();
  });

  it('writes rule mode as a flat array, normalizing the wrapper away', () => {
    const { entries } = readSlot('view', { views: [{ rule: RULE, view: VIEW_REF, loadData: true }] });
    expect(writeSlotEntries('view', entries)).toEqual([
      { rule: RULE, view: VIEW_REF, loadData: true },
    ]);
  });

  it('drops the slot when there are no rule entries', () => {
    expect(writeSlotEntries('view', [])).toBeUndefined();
  });

  it('omits loadData when false, and never emits it for schema slots', () => {
    expect(writeSlotEntries('view', [{ ref: VIEW_REF, loadData: false }])).toEqual([
      { view: VIEW_REF },
    ]);
    expect(writeSlotEntries('schema', [{ ref: SCHEMA_REF, loadData: true }])).toEqual([
      { schema: SCHEMA_REF },
    ]);
  });

  it('omits rule on a fallback entry rather than writing undefined', () => {
    const written = writeSlotEntries('view', [{ ref: VIEW_REF }]);
    expect(written).toEqual([{ view: VIEW_REF }]);
    expect(Object.keys(written![0])).not.toContain('rule');
  });

  it('substitutes a blank reference for an entry that has none, keeping the entry', () => {
    expect(writeSlotEntries('view', [{ rule: RULE }])).toEqual([
      { rule: RULE, view: { key: '', domain: '', version: '1.0.0', flow: 'sys-views' } },
    ]);
  });

  it('strips keys the contract forbids on rule entries', () => {
    // viewRuleEntry is additionalProperties:false — `extensions` is valid
    // on state/transition views but rejected on a function view, so a
    // hand-edited file carrying it was already failing validation.
    const { entries } = readSlot('view', [{ view: VIEW_REF, extensions: ['x'], _comment: 'hi' }]);
    expect(writeSlotEntries('view', entries)).toEqual([{ view: VIEW_REF }]);
  });

  it('round-trips every wire shape to the canonical form', () => {
    const shapes = [
      VIEW_REF,
      [{ view: VIEW_REF }],
      { views: [{ view: VIEW_REF }] },
    ];
    for (const shape of shapes) {
      const state = readSlot('view', shape);
      const written =
        state.mode === 'single' ? writeSlotSingle(state.ref) : writeSlotEntries('view', state.entries);
      // Re-reading the written value yields the same normalized state.
      expect(readSlot('view', written)).toEqual({ ...state, unrecognized: false });
    }
  });
});

describe('mode switching', () => {
  it('carries a single reference into rule mode as the sole fallback entry', () => {
    expect(entriesFromSingle(VIEW_REF)).toEqual([{ ref: VIEW_REF }]);
  });

  it('starts rule mode empty when there was no reference to carry', () => {
    expect(entriesFromSingle(null)).toEqual([]);
    expect(entriesFromSingle(emptyComponentRef('view'))).toEqual([]);
  });

  it('collapsing to single mode keeps the first usable reference', () => {
    const entries: SlotRuleEntry[] = [{ rule: RULE }, { rule: RULE, ref: VIEW_REF }];
    expect(singleFromEntries(entries)).toEqual(VIEW_REF);
  });

  it('collapsing an empty rule list yields no reference', () => {
    expect(singleFromEntries([])).toBeNull();
    expect(singleFromEntries([{ rule: RULE }])).toBeNull();
  });
});

describe('fallback ordering', () => {
  it('treats a rule-less entry as the fallback', () => {
    expect(findShadowingFallbackIndex([{ rule: RULE, ref: VIEW_REF }, { ref: VIEW_REF }])).toBe(-1);
  });

  it('flags a rule-less entry that shadows the entries after it', () => {
    expect(findShadowingFallbackIndex([{ ref: VIEW_REF }, { rule: RULE, ref: VIEW_REF }])).toBe(0);
  });

  it('accepts a single rule-less entry and an empty list', () => {
    expect(findShadowingFallbackIndex([{ ref: VIEW_REF }])).toBe(-1);
    expect(findShadowingFallbackIndex([])).toBe(-1);
  });
});

describe('verbs', () => {
  it('reads only known verbs, in canonical order', () => {
    expect(readVerbs(['DELETE', 'GET', 'PUT', 'nonsense'])).toEqual(['GET', 'DELETE']);
  });

  it('reads a missing or non-array value as empty', () => {
    expect(readVerbs(undefined)).toEqual([]);
    expect(readVerbs('GET')).toEqual([]);
  });

  it('de-duplicates and reorders to the canonical sequence', () => {
    expect(normalizeVerbs(['PATCH', 'GET', 'PATCH', 'POST'])).toEqual(['GET', 'POST', 'PATCH']);
  });

  it('collapses an empty selection to undefined — minItems is 1', () => {
    // An absent key means "no verb restriction"; [] would fail validation.
    expect(normalizeVerbs([])).toBeUndefined();
    expect(normalizeVerbs(['PUT'])).toBeUndefined();
  });

  it('toggles a verb on and off', () => {
    expect(toggleVerb(['GET'], 'POST', true)).toEqual(['GET', 'POST']);
    expect(toggleVerb(['GET', 'POST'], 'GET', false)).toEqual(['POST']);
    expect(toggleVerb(['GET'], 'GET', false)).toBeUndefined();
  });

  it('is idempotent when enabling an already-selected verb', () => {
    expect(toggleVerb(['GET'], 'GET', true)).toEqual(['GET']);
  });
});

describe('reference helpers', () => {
  it('identifies the file-reference form', () => {
    expect(isComponentFileRef({ ref: './a.json' })).toBe(true);
    expect(isComponentFileRef(VIEW_REF)).toBe(false);
    expect(isComponentFileRef(null)).toBe(false);
  });

  it('treats a blank key or blank ref as empty', () => {
    expect(isEmptyComponentRef({ key: '  ', domain: 'd', version: '1.0.0', flow: 'sys-views' })).toBe(true);
    expect(isEmptyComponentRef(VIEW_REF)).toBe(false);
  });

  it('stamps the slot flow onto a picked component', () => {
    expect(refFromDiscoveredComponent('view', { key: 'form' }, 'lending')).toEqual({
      key: 'form',
      domain: 'lending',
      version: '1.0.0',
      flow: 'sys-views',
    });
    expect(refFromDiscoveredComponent('schema', { key: 's', version: '3.0.0' }, 'lending').flow).toBe(
      'sys-schemas',
    );
  });
});
