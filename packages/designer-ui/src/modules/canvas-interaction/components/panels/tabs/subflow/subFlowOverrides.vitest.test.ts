import { describe, expect, it } from 'vitest';
import type { ResourceReference, SubFlowConfig, SubFlowStateOverride } from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';
import {
  applyLegacyViewMigration,
  countOverrides,
  hasLegacyViews,
  legacyViewOverrides,
  nextOverrideKey,
  overrideWarnings,
  parseFallbackSeconds,
  planLegacyViewMigration,
  renameRecordKey,
  setLongPollOverride,
} from './subFlowOverrides';

const ref = (key: string): ResourceReference => ({ key, domain: 'core', version: '1.0.0', flow: 'sys-views' });
const PROCESS = { key: 'subflow-override-lab-child', domain: 'core', version: '1.0.2', flow: 'sys-flows' };

const CHILD: ChildWorkflowSummary = {
  states: [
    { key: 'lp-wait', longPollAuth: 'roles', viewKeys: ['child-lp-view'] },
    { key: 'gate', longPollAuth: 'rule', viewKeys: [] },
    { key: 'child-done', longPollAuth: null, viewKeys: [] },
  ],
  transitions: [
    { key: 'confirm', viewKeys: ['child-confirm-view'] },
    { key: 'note', viewKeys: ['child-lp-view'] },
  ],
};

describe('countOverrides', () => {
  it('counts every set field, view swaps and legacy entries', () => {
    const sf: SubFlowConfig = {
      type: 'S',
      process: PROCESS,
      viewOverrides: { 'old-view': ref('x') },
      overrides: {
        timeout: { key: 'child-abandoned', target: 'child-timedout' },
        transitions: { confirm: { roles: [], views: { 'child-confirm-view': ref('p') } } },
        states: {
          'lp-wait': {
            queryRoles: [{ role: 'a', grant: 'allow' }],
            interaction: { longPoll: { fallbackTimeoutSeconds: 120, roles: [] } },
            views: { 'child-lp-view': ref('q') },
          },
          'child-done': {},
        },
      },
    };
    // timeout 1 + confirm roles 1 + confirm view 1 + lp-wait queryRoles 1 + window 1 + lp roles 1 + lp view 1 + legacy 1
    expect(countOverrides(sf)).toBe(8);
  });

  it('is zero without overrides', () => {
    expect(countOverrides({})).toBe(0);
  });
});

describe('overrideWarnings', () => {
  it('flags empty role lists', () => {
    const codes = overrideWarnings(
      {
        overrides: {
          transitions: { confirm: { roles: [] } },
          states: { 'lp-wait': { queryRoles: [], interaction: { longPoll: { roles: [] } } } },
        },
      },
      null,
    ).map((w) => w.code);
    expect(codes).toEqual(['roles-empty', 'roles-empty', 'roles-empty']);
  });

  it('flags a roles override on a rule-gated child long poll', () => {
    const warnings = overrideWarnings(
      { overrides: { states: { gate: { interaction: { longPoll: { roles: [{ role: 'p', grant: 'allow' }] } } } } } },
      CHILD,
    );
    expect(warnings).toEqual([expect.objectContaining({ code: 'roles-ignored-rule' })]);
    expect(warnings[0].message).toContain('gate');
  });

  it('flags a long-poll override on a child state without a long poll', () => {
    const warnings = overrideWarnings(
      { overrides: { states: { 'child-done': { interaction: { longPoll: { fallbackTimeoutSeconds: 30 } } } } } },
      CHILD,
    );
    expect(warnings.map((w) => w.code)).toEqual(['longpoll-inert']);
  });

  it('does not flag an empty long-poll roles list on a rule-gated child state as roles-empty', () => {
    const warnings = overrideWarnings(
      { overrides: { states: { gate: { interaction: { longPoll: { roles: [] } } } } } },
      CHILD,
    );
    expect(warnings.map((w) => w.code)).toEqual(['roles-ignored-rule']);
  });

  it('does not judge child-dependent rules without a child or for unknown keys', () => {
    const sf = { overrides: { states: { gate: { interaction: { longPoll: { roles: [{ role: 'p', grant: 'allow' as const }] } } } } } };
    expect(overrideWarnings(sf, null)).toEqual([]);
    expect(overrideWarnings({ overrides: { states: { unknown: { interaction: { longPoll: { fallbackTimeoutSeconds: 5 } } } } } }, CHILD)).toEqual([]);
  });

  it('flags legacy views, and mixing them with scoped views', () => {
    expect(overrideWarnings({ viewOverrides: { v: ref('x') } }, null).map((w) => w.code)).toEqual(['legacy-views']);
    expect(
      overrideWarnings(
        { overrides: { views: { v: ref('x') }, states: { 'lp-wait': { views: { w: ref('y') } } } } },
        null,
      ).map((w) => w.code),
    ).toEqual(['legacy-views', 'mixed-views']);
  });

  it('flags an empty overrides.views as legacy-present when scoped views also exist (mixed warning)', () => {
    // overrides.views: {} is non-null, so HasViewOverrides is true even though
    // the effective map (Overrides?.Views ?? ViewOverrides) contributes nothing.
    const codes = overrideWarnings(
      { overrides: { views: {}, states: { 'lp-wait': { views: { w: ref('y') } } } } },
      null,
    ).map((w) => w.code);
    expect(codes).toEqual(['legacy-views', 'mixed-views']);
  });

  it('flags when both legacy maps are set — viewOverrides is ignored', () => {
    const codes = overrideWarnings(
      { viewOverrides: { v: ref('old') }, overrides: { views: { v: ref('new') } } },
      null,
    ).map((w) => w.code);
    expect(codes).toEqual(['legacy-views', 'legacy-views-ignored']);
  });
});

describe('F1: legacy view map is whole-map replacement, not a merge', () => {
  it('legacyViewOverrides ignores viewOverrides entirely once overrides.views is set', () => {
    expect(
      legacyViewOverrides({ viewOverrides: { a: ref('legacy-a') }, overrides: { views: { b: ref('new-b') } } }),
    ).toEqual({ b: ref('new-b') });
    expect(legacyViewOverrides({ overrides: { views: {} }, viewOverrides: { a: ref('legacy-a') } })).toEqual({});
  });

  it('falls back to viewOverrides only when overrides.views is absent', () => {
    expect(legacyViewOverrides({ viewOverrides: { a: ref('legacy-a') } })).toEqual({ a: ref('legacy-a') });
    expect(legacyViewOverrides({})).toEqual({});
  });

  it('hasLegacyViews is a non-null test — an empty overrides.views still counts as legacy present', () => {
    expect(hasLegacyViews({ overrides: { views: {} } })).toBe(true);
    expect(hasLegacyViews({ viewOverrides: { a: ref('x') } })).toBe(true);
    expect(hasLegacyViews({})).toBe(false);
    expect(hasLegacyViews({ overrides: {} })).toBe(false);
  });

  it('countOverrides counts from the effective map only', () => {
    expect(
      countOverrides({ viewOverrides: { a: ref('legacy-a'), b: ref('legacy-b') }, overrides: { views: { c: ref('new-c') } } }),
    ).toBe(1);
    expect(countOverrides({ overrides: { views: {} }, viewOverrides: { a: ref('legacy-a') } })).toBe(0);
  });

  it('migration moves only overrides.views entries when both legacy maps are present', () => {
    const sf: SubFlowConfig = {
      type: 'S',
      process: PROCESS,
      viewOverrides: { 'child-confirm-view': ref('stale-legacy') },
      overrides: { views: { 'child-lp-view': ref('effective-legacy') } },
    };
    const plan = planLegacyViewMigration(sf, CHILD);
    expect(plan).toEqual({
      states: { 'lp-wait': { 'child-lp-view': ref('effective-legacy') } },
      transitions: { note: { 'child-lp-view': ref('effective-legacy') } },
      unplaced: [],
    });
    applyLegacyViewMigration(sf, plan);
    expect(sf.overrides?.states?.['lp-wait'].views).toEqual({ 'child-lp-view': ref('effective-legacy') });
    expect(sf.overrides?.transitions?.note.views).toEqual({ 'child-lp-view': ref('effective-legacy') });
    // Both legacy maps are cleared on a successful migration, even though only
    // overrides.views entries were actually moved.
    expect(sf.viewOverrides).toBeUndefined();
    expect(sf.overrides?.views).toBeUndefined();
  });
});

describe('legacy view migration', () => {
  it('places each legacy view on every child state and transition that selects it', () => {
    const sf: SubFlowConfig = { type: 'S', process: PROCESS, overrides: { views: { 'child-lp-view': ref('legacy') } } };
    const plan = planLegacyViewMigration(sf, CHILD);
    expect(plan).toEqual({
      states: { 'lp-wait': { 'child-lp-view': ref('legacy') } },
      transitions: { note: { 'child-lp-view': ref('legacy') } },
      unplaced: [],
    });

    applyLegacyViewMigration(sf, plan);
    expect(sf).toEqual({
      type: 'S',
      process: PROCESS,
      overrides: {
        states: { 'lp-wait': { views: { 'child-lp-view': ref('legacy') } } },
        transitions: { note: { views: { 'child-lp-view': ref('legacy') } } },
      },
    });
    expect(hasLegacyViews(sf)).toBe(false);
  });

  it('reads subFlow.viewOverrides too and keeps existing scoped entries', () => {
    const sf: SubFlowConfig = {
      type: 'S',
      process: PROCESS,
      viewOverrides: { 'child-confirm-view': ref('legacy') },
      overrides: { transitions: { confirm: { views: { 'child-confirm-view': ref('scoped') } } } },
    };
    applyLegacyViewMigration(sf, planLegacyViewMigration(sf, CHILD));
    expect(sf.viewOverrides).toBeUndefined();
    expect(sf.overrides?.transitions?.confirm.views).toEqual({ 'child-confirm-view': ref('scoped') });
  });

  it('refuses when a legacy key is selected nowhere in the child', () => {
    const sf: SubFlowConfig = { type: 'S', process: PROCESS, viewOverrides: { ghost: ref('x') } };
    const plan = planLegacyViewMigration(sf, CHILD);
    expect(plan.unplaced).toEqual(['ghost']);
    applyLegacyViewMigration(sf, plan);
    expect(sf.viewOverrides).toEqual({ ghost: ref('x') });
  });
});

describe('parseFallbackSeconds', () => {
  it('accepts whole numbers of at least 1 and blank', () => {
    expect(parseFallbackSeconds('120')).toEqual({ ok: true, value: 120 });
    expect(parseFallbackSeconds(' ')).toEqual({ ok: true, value: undefined });
  });

  it('rejects zero, negatives, fractions and text', () => {
    for (const text of ['0', '-5', '1.5', 'abc']) expect(parseFallbackSeconds(text)).toEqual({ ok: false });
  });
});

describe('setLongPollOverride', () => {
  it('sets and clears single fields, dropping an empty interaction', () => {
    const entry: SubFlowStateOverride = {};
    setLongPollOverride(entry, { fallbackTimeoutSeconds: 180 });
    expect(entry).toEqual({ interaction: { longPoll: { fallbackTimeoutSeconds: 180 } } });

    setLongPollOverride(entry, { roles: [] });
    expect(entry).toEqual({ interaction: { longPoll: { fallbackTimeoutSeconds: 180, roles: [] } } });

    setLongPollOverride(entry, { fallbackTimeoutSeconds: undefined });
    expect(entry).toEqual({ interaction: { longPoll: { roles: [] } } });

    setLongPollOverride(entry, { roles: undefined });
    expect(entry).toEqual({});
  });
});

describe('record key helpers', () => {
  it('renames in place, preserving order', () => {
    const record: Record<string, number> = { a: 1, b: 2, c: 3 };
    expect(renameRecordKey(record, 'b', 'x')).toBe(true);
    expect(Object.keys(record)).toEqual(['a', 'x', 'c']);
    expect(record.x).toBe(2);
  });

  it('refuses a clash or a missing source', () => {
    const record: Record<string, number> = { a: 1, b: 2 };
    expect(renameRecordKey(record, 'a', 'b')).toBe(false);
    expect(renameRecordKey(record, 'zzz', 'y')).toBe(false);
    expect(record).toEqual({ a: 1, b: 2 });
  });

  it('suggests the first unused option, else a numbered key', () => {
    expect(nextOverrideKey({ confirm: 1 }, ['confirm', 'note'], 'transition')).toBe('note');
    expect(nextOverrideKey({ 'state-2': 1 }, [], 'state')).toBe('state-3');
  });
});
