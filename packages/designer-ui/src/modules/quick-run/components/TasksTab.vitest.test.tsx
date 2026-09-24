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

  it('groups by transition with status, business status, duration and the error', () => {
    const html = renderToStaticMarkup(createElement(TasksTabContent, { items: [FAULTED], loading: false, error: null }));
    for (const text of ['approve', 'draft', 'call-core', 'faulted', 'failed', '1.5 s', 'Upstream 503']) {
      expect(html).toContain(text);
    }
  });

  it('shows the runtime error', () => {
    const html = renderToStaticMarkup(
      createElement(TasksTabContent, { items: null, loading: false, error: { code: 'X', message: 'Runtime returned HTTP 403' } }),
    );
    expect(html).toContain('Task history request failed');
  });
});
