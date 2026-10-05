import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ElementMetricsView } from './ElementMetrics';
import { FunctionMetricsView } from './FunctionMetrics';
import { TasksTabContent } from './TasksTab';

describe('ElementMetricsView', () => {
  it('lists attempts with their tasks, hook and order', () => {
    const html = renderToStaticMarkup(
      createElement(ElementMetricsView, {
        metrics: {
          element: { kind: 'transition', key: 'to-review' },
          count: 1,
          attempts: [
            {
              seq: 1,
              durationMs: 1104,
              triggerType: 'manual',
              triggeredBy: 'alice',
              tasks: [{ id: 't', taskKey: 'risk', hook: 'onExecute', order: 2, status: 'completed', durationMs: 511 }],
            },
          ],
        },
      }),
    );
    expect(html).toContain('#1');
    expect(html).toContain('by alice');
    expect(html).toContain('1.1 s');
    expect(html).toContain('risk');
    expect(html).toContain('onExecute');
    expect(html).toContain('#2');
  });

  it('says a state visit is still open', () => {
    const html = renderToStaticMarkup(
      createElement(ElementMetricsView, {
        metrics: { element: { kind: 'state', key: 'review' }, count: 1, attempts: [{ seq: 1, durationMs: null, tasks: [] }] },
      }),
    );
    expect(html).toContain('still here');
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

describe('TasksTabContent hook / order', () => {
  it('renders the 0.0.99 hook and order when present', () => {
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
    expect(html).toContain('onEntry');
    expect(html).toContain('#3');
  });
});
