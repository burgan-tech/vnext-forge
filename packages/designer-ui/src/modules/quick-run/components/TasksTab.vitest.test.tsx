import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { TaskHistoryItem } from '../types/quickrun.types';
import { TasksTabContent } from './TasksTab';

const FAULTED: TaskHistoryItem = {
  id: '1', taskKey: 'call-core', transitionKey: 'approve', fromState: 'draft', toState: null, triggerType: 'manual',
  status: 'faulted', businessStatus: 'failed', startedAt: '2026-09-20T10:00:00Z', durationMs: 1500, error: 'Upstream 503',
};

describe('TasksTabContent', () => {
  it('has an empty state', () => {
    expect(renderToStaticMarkup(createElement(TasksTabContent, { items: [], loading: false, error: null }))).toContain(
      'No tasks ran on this instance yet',
    );
  });

  it('groups by transition with one status icon, duration and the first error line', () => {
    const html = renderToStaticMarkup(createElement(TasksTabContent, { items: [FAULTED], loading: false, error: null }));
    for (const text of ['approve', 'draft', 'call-core', 'aria-label="Failed"', '1.5 s', 'Upstream 503', '1 failed']) {
      expect(html).toContain(text);
    }
    // One verdict, not two status chips.
    expect(html).not.toContain('>faulted<');
  });

  it('uses the transition label and offers the Failed filter only when something failed', () => {
    const html = renderToStaticMarkup(
      createElement(TasksTabContent, {
        items: [FAULTED],
        loading: false,
        error: null,
        transitionLabel: () => 'Approve request',
      }),
    );
    expect(html).toContain('Approve request');
    expect(html).toContain('Failed (1)');
    const ok = renderToStaticMarkup(
      createElement(TasksTabContent, {
        items: [{ ...FAULTED, status: 'completed', businessStatus: 'success', error: null }],
        loading: false,
        error: null,
      }),
    );
    expect(ok).not.toContain('Failed (');
  });

  it('groups same-order tasks as parallel and words the hook', () => {
    const a = { ...FAULTED, id: 'a', status: 'completed', businessStatus: 'success', error: null, order: 1, hook: 'onExecute' };
    const b = { ...a, id: 'b', taskKey: 'call-other', hook: 'onExit' };
    const html = renderToStaticMarkup(createElement(TasksTabContent, { items: [a, b], loading: false, error: null }));
    expect(html).toContain('Parallel · 2 tasks');
    expect(html).toContain('on transition');
    expect(html).toContain('on exit of draft');
  });

  it('shows the runtime error', () => {
    const html = renderToStaticMarkup(
      createElement(TasksTabContent, { items: null, loading: false, error: { code: 'X', message: 'Runtime returned HTTP 403' } }),
    );
    expect(html).toContain('Task history request failed');
  });
});

describe('segmentByOrder', () => {
  it('keeps first-seen order and merges equal orders', async () => {
    const { segmentByOrder } = await import('./TasksTab');
    const row = (id: string, order: number | null) => ({ ...FAULTED, id, order });
    expect(segmentByOrder([row('a', 1), row('b', 2), row('c', 1), row('d', null)]).map((s) => s.items.map((i) => i.id))).toEqual([
      ['a', 'c'],
      ['b'],
      ['d'],
    ]);
  });
});

describe('TaskDetailsList', () => {
  it('shows both statuses, the phase and a copyable run id', async () => {
    const { TaskDetailsList } = await import('./TasksTab');
    const html = renderToStaticMarkup(createElement(TaskDetailsList, { task: { ...FAULTED, hook: 'onEntry', toState: 'review' } }));
    for (const text of ['faulted', 'failed', 'on entry of review', 'Copy Task run id']) expect(html).toContain(text);
  });
});
