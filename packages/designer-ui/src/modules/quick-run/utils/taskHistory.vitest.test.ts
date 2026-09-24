import { describe, expect, it } from 'vitest';

import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs, groupTasksByTransition, taskStatusTone } from './taskHistory';

const item = (over: Partial<TaskHistoryItem>): TaskHistoryItem => ({
  id: 'x', taskKey: 't', transitionKey: 'approve', fromState: 'draft', toState: 'approved', triggerType: 'manual',
  status: 'completed', businessStatus: 'success', startedAt: '2026-09-20T10:00:00Z', ...over,
});

describe('groupTasksByTransition', () => {
  it('groups consecutive tasks of one transition and keeps repeats apart', () => {
    const groups = groupTasksByTransition([
      item({ id: '1' }),
      item({ id: '2' }),
      item({ id: '3', transitionKey: 'submit', fromState: 'approved', toState: null }),
      item({ id: '4' }),
    ]);
    expect(groups.map((g) => [g.transitionKey, g.toState, g.items.map((i) => i.id)])).toEqual([
      ['approve', 'approved', ['1', '2']],
      ['submit', null, ['3']],
      ['approve', 'approved', ['4']],
    ]);
    expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  });
});

describe('formatDurationMs', () => {
  it.each([
    [184.2, '184 ms'],
    [1_500, '1.5 s'],
    [61_000, '1m 1s'],
  ])('%d → %s', (ms, expected) => expect(formatDurationMs(ms)).toBe(expected));

  it('returns null without a duration', () => {
    expect(formatDurationMs(null)).toBeNull();
    expect(formatDurationMs(undefined)).toBeNull();
  });
});

describe('taskStatusTone', () => {
  it('maps platform and business statuses', () => {
    expect(taskStatusTone('completed')).toBe('success');
    expect(taskStatusTone('success')).toBe('success');
    expect(taskStatusTone('faulted')).toBe('danger');
    expect(taskStatusTone('failed')).toBe('danger');
    expect(taskStatusTone('busy')).toBe('busy');
    expect(taskStatusTone('waiting')).toBe('busy');
    expect(taskStatusTone('unknown')).toBe('neutral');
  });
});
