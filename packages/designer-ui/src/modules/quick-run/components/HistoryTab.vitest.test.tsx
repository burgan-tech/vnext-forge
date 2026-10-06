import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { HistoryTransition, TaskHistoryItem } from '../types/quickrun.types';
import { HistoryTabContent, transitionDetailTabs } from './HistoryTab';
import { DetailsBody } from './panel-kit';

const T = (id: string, transitionId: string, from: string, to: string, trigger = 'manual'): HistoryTransition => ({
  id,
  transitionId,
  fromState: from,
  toState: to,
  startedAt: '2026-10-06T10:00:00Z',
  durationSeconds: 0.09,
  triggerType: trigger,
  createdAt: '2026-10-06T10:00:00Z',
  body: { a: 1 },
});

const history = { transitions: [T('1', 'start-login', 'start', 'login'), T('2', 'to-ready', 'login', 'ready', 'automatic'), T('3', 'to-ready', 'ready', 'ready', 'automatic')] };

describe('HistoryTabContent', () => {
  const render = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(HistoryTabContent, { history, loading: false, ...extra }));

  it('lists one row per transition, newest first, without inline expanders', () => {
    const html = render();
    expect(html.indexOf('start → login')).toBeGreaterThan(html.indexOf('ready → ready'));
    expect(html).not.toContain('Attempts of');
    expect(html).not.toContain('Visits of');
    expect(html).toContain('90 ms');
  });

  it('labels transitions and marks non-manual triggers and repeats', () => {
    const html = render({ transitionLabel: (k: string) => (k === 'start-login' ? 'Start login' : k) });
    expect(html).toContain('Start login');
    expect(html).toContain('>automatic<');
    expect(html).toContain('run 2 of 2');
  });
});

describe('transitionDetailTabs', () => {
  const tabIds = (tabs: ReturnType<typeof transitionDetailTabs>) => tabs.map((t) => t.label);

  it('offers executions and time in the target state on runtime 0.0.99', () => {
    const tabs = transitionDetailTabs(T('1', 'start-login', 'start', 'login'), {
      loadMetrics: async () => ({ success: false as const, error: { message: 'x' } }),
    });
    expect(tabIds(tabs)).toEqual(['Overview', 'Executions', 'Time in login', 'Request']);
  });

  it('falls back to the task journal on older runtimes', () => {
    const task = {
      id: 't', taskKey: 'start-subprocess', transitionKey: 'start-login', fromState: 'start', toState: 'login',
      triggerType: 'manual', status: 'completed', businessStatus: 'success', startedAt: '2026-10-06T10:00:00Z', hook: 'onEntry',
    } as TaskHistoryItem;
    const tabs = transitionDetailTabs(T('1', 'start-login', 'start', 'login'), { tasks: [task] });
    expect(tabIds(tabs)).toEqual(['Overview', 'Tasks (1)', 'Request']);
    const html = renderToStaticMarkup(createElement(DetailsBody, { tabs, initialTab: 'tasks' }));
    expect(html).toContain('start-subprocess');
    expect(html).toContain('on entry of login');
  });

  it('shows the overview with a copyable record id', () => {
    const html = renderToStaticMarkup(createElement(DetailsBody, { tabs: transitionDetailTabs(T('rec-1', 'go', 'a', 'b'), {}) }));
    expect(html).toContain('a → b');
    expect(html).toContain('Copy Record id');
  });
});
