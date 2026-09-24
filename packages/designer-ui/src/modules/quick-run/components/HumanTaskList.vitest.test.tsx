import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { HumanTaskItem } from '../types/quickrun.types';
import { HumanTaskList, type HumanTaskListProps } from './HumanTaskList';

const ROWS: HumanTaskItem[] = [
  { instanceId: 'APP-1', id: 'id-1', workflow: 'ht-a', title: 'Approve A', description: 'Level A', createdAt: '2026-09-20T10:00:00Z' },
  { instanceId: 'APP-2', id: 'id-2', workflow: 'ht-b', title: 'Approve B', description: null, createdAt: '2026-09-20T11:00:00Z' },
];

const render = (over: Partial<HumanTaskListProps> = {}) =>
  renderToStaticMarkup(
    createElement(HumanTaskList, {
      rows: ROWS,
      truncated: false,
      loading: false,
      error: null,
      currentWorkflowKey: 'ht-a',
      canOpenOtherWorkflows: true,
      onOpen: () => undefined,
      ...over,
    }),
  );

describe('HumanTaskList', () => {
  it('renders title, description, workflow and business key', () => {
    const html = render();
    for (const text of ['Approve A', 'Level A', 'ht-b', 'APP-2']) expect(html).toContain(text);
  });

  it('warns when the runtime truncated the list', () => {
    expect(render({ truncated: true })).toContain('The runtime truncated this list');
  });

  it('disables rows of other workflows when the host cannot open them', () => {
    const html = render({ canOpenOtherWorkflows: false });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Approve B/);
  });

  it('has an empty state', () => {
    expect(render({ rows: [] })).toContain('No human tasks for this role');
  });

  it('shows the runtime error', () => {
    expect(render({ error: { code: 'X', message: 'Runtime returned HTTP 500', details: { httpStatus: 500 } } })).toContain(
      'Human-task request failed',
    );
  });
});
