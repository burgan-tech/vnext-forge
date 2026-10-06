import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateVisitsView, TransitionExecutionsView } from './ElementMetrics';
import { FunctionMetricsView } from './FunctionMetrics';
import { TasksTabContent } from './TasksTab';

describe('TransitionExecutionsView', () => {
  it('splits the tasks of each execution into before / during / after', () => {
    const html = renderToStaticMarkup(
      createElement(TransitionExecutionsView, {
        fromState: 'draft',
        toState: 'review',
        metrics: {
          element: { kind: 'transition', key: 'submit' },
          count: 2,
          attempts: [
            {
              seq: 1,
              durationMs: 1104,
              triggerType: 'manual',
              triggeredBy: 'alice',
              tasks: [
                { id: 'x', taskKey: 'leave-draft', hook: 'onExit', status: 'completed', businessStatus: 'success' },
                { id: 't', taskKey: 'risk', hook: 'onExecute', order: 2, status: 'completed', durationMs: 511 },
                { id: 'e', taskKey: 'enter-review', hook: 'onEntry', status: 'faulted', error: 'boom' },
              ],
            },
            { seq: 2, durationMs: 20, tasks: [] },
          ],
        },
      }),
    );
    for (const text of ['Execution 1 of 2', 'by alice', '1.1 s', 'Before · on exit of draft', 'During the transition', 'After · on entry of review', 'boom', 'No tasks ran.']) {
      expect(html).toContain(text);
    }
  });
});

describe('StateVisitsView', () => {
  it('says how long the instance stayed, or that it is still there', () => {
    const html = renderToStaticMarkup(
      createElement(StateVisitsView, {
        stateKey: 'review',
        metrics: {
          element: { kind: 'state', key: 'review' },
          count: 2,
          attempts: [
            { seq: 1, durationMs: 41900, tasks: [] },
            { seq: 2, durationMs: null, tasks: [] },
          ],
        },
      }),
    );
    expect(html).toContain('stayed 41.9 s');
    expect(html).toContain('still here');
    expect(html).toContain('Visit 2 of 2');
  });
});

describe('FunctionMetricsView', () => {
  it('shows the summary and rows', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionMetricsView, {
        metrics: {
          items: [
            { executionId: 'e', invokedAt: '2026-10-01T10:00:00Z', durationMs: 42, succeeded: false, status: 'faulted', statusCode: 500, error: 'boom' },
          ],
          summary: { count: 1, p50Ms: 42, p95Ms: 42, failureRate: 1 },
          hasNext: false,
        },
      }),
    );
    expect(html).toContain('Calls: 1');
    expect(html).toContain('Failure rate: 100.0%');
    expect(html).toContain('faulted');
    expect(html).toContain('boom');
  });

  it('explains an empty journal', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionMetricsView, { metrics: { items: [], summary: { count: 0 }, hasNext: false } }),
    );
    expect(html).toContain('executionLog: E');
  });
});

describe('TasksTabContent hook', () => {
  it('words the 0.0.99 hook', () => {
    const html = renderToStaticMarkup(
      createElement(TasksTabContent, {
        loading: false,
        error: null,
        items: [
          {
            id: 'x',
            taskKey: 'send',
            transitionKey: 'go',
            fromState: 'a',
            toState: 'b',
            triggerType: 'manual',
            status: 'completed',
            businessStatus: 'success',
            startedAt: '2026-10-01T10:00:00Z',
            hook: 'onEntry',
            order: 3,
          },
        ],
      }),
    );
    expect(html).toContain('on entry of b');
  });
});
