import { describe, expect, it } from 'vitest';

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import type { HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { normalizeTrigger, pathRailSteps, railSummary } from './pathRail';

const VM = normalizeDefinition({
  key: 'loan',
  version: '1',
  attributes: {
    states: [{ key: 'init', stateType: 1, transitions: [{ key: 'submit', target: 'review', labels: [{ language: 'en-US', label: 'Submit' }] }] }, { key: 'review', stateType: 2 }],
  },
});
const h = (id: string, key: string, from: string, to: string, startedAt: string, extra: Partial<HistoryTransition> = {}): HistoryTransition => ({
  id, transitionId: key, fromState: from, toState: to, startedAt, triggerType: 'Manual', createdAt: 'x', ...extra,
});
const task = (id: string, key: string, from: string, startedAt: string, status: string, extra: Partial<TaskHistoryItem> = {}): TaskHistoryItem => ({
  id, taskKey: 't', transitionKey: key, fromState: from, toState: null, triggerType: 'manual', status, businessStatus: 'unknown', startedAt, ...extra,
});

describe('normalizeTrigger', () => {
  it('maps case-insensitively with aliases', () => {
    expect(['Manual', 'AUTO', 'automatic', 'Timer', 'scheduled', 'Signal', 'event', 'x', ''].map(normalizeTrigger)).toEqual([
      'manual', 'automatic', 'automatic', 'scheduled', 'scheduled', 'event', 'event', 'other', 'other',
    ]);
  });
});

describe('pathRailSteps', () => {
  const history = [
    h('a', 'submit', 'init', 'review', '2026-10-06T10:00:00Z', { durationSeconds: 2, finishedAt: '2026-10-06T10:00:02Z' }),
    h('b', 'submit', 'init', 'review', '2026-10-06T10:05:00Z', { triggerType: 'event' }),
  ];
  const tasks = [
    task('1', 'submit', 'init', '2026-10-06T10:00:01Z', 'faulted'),
    task('2', 'submit', 'init', '2026-10-06T10:05:01Z', 'completed'),
    task('3', 'submit', 'init', '2026-10-06T10:05:02Z', 'faulted', { toState: 'review' }),
    task('4', 'other', 'init', '2026-10-06T10:05:02Z', 'faulted'),
  ];
  it('counts failed tasks per firing window, labels, durations, triggers', () => {
    const steps = pathRailSteps(history, { tasks, vm: VM });
    expect(steps.map((s) => s.failedTasks)).toEqual([1, 1]);
    expect(steps[0]).toMatchObject({ order: 1, label: 'Submit', durationMs: 2000, trigger: 'manual', historyId: 'a' });
    expect(steps[1]).toMatchObject({ order: 2, durationMs: null, trigger: 'event' });
  });
  it('bounds an unfinished firing by the next firing start', () => {
    const hist = [h('a', 'submit', 'init', 'review', '2026-10-06T10:00:00Z'), h('b', 'submit', 'init', 'review', '2026-10-06T10:05:00Z')];
    const steps = pathRailSteps(hist, { tasks: [task('1', 'submit', 'init', '2026-10-06T10:02:00Z', 'faulted')], vm: VM });
    expect(steps.map((s) => s.failedTasks)).toEqual([1, 0]);
  });
  it('flags data writes from the attributed rows', () => {
    const steps = pathRailSteps(history, { tasks: [], vm: VM, rowsByFiring: new Map([['b', [{} as never]]]) });
    expect(steps.map((s) => s.wroteData)).toEqual([false, true]);
  });
  it('summarises', () => {
    const steps = pathRailSteps(history, { tasks, vm: VM });
    expect(railSummary(steps)).toEqual({ count: 2, totalMs: null, failedSteps: 2 });
    expect(railSummary(steps.slice(0, 1))).toEqual({ count: 1, totalMs: 2000, failedSteps: 1 });
    expect(railSummary([])).toEqual({ count: 0, totalMs: null, failedSteps: 0 });
  });
});

import { railFocus } from './pathRail';

describe('railFocus', () => {
  const mk = (order: number, key: string) => ({ order, transitionKey: key });
  const steps = [mk(1, 'a'), mk(2, 'b'), mk(3, 'a'), mk(4, 'c')];
  it('targets the most recent firing when the selection came from elsewhere', () => {
    expect(railFocus(steps, 'a', null)).toEqual({ ringOrder: null, scrollOrder: 3 });
  });
  it('keeps the clicked firing', () => {
    expect(railFocus(steps, 'a', 1)).toEqual({ ringOrder: 1, scrollOrder: 1 });
  });
  it('ignores a clicked firing that no longer matches the key', () => {
    expect(railFocus(steps, 'b', 1)).toEqual({ ringOrder: null, scrollOrder: 2 });
  });
  it('has no target without a selection or match', () => {
    expect(railFocus(steps, null, 1)).toEqual({ ringOrder: null, scrollOrder: null });
    expect(railFocus(steps, 'zzz', null)).toEqual({ ringOrder: null, scrollOrder: null });
  });
});
