import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateExecution } from './StateExecution';
import { TransitionExecution } from './TransitionExecution';

const task = (id: string, over: Record<string, unknown>) => ({ id, taskKey: `task-${id}`, transitionKey: 'submit', fromState: 'init', toState: 'review', triggerType: 'manual', status: 'Completed', businessStatus: 'Success', startedAt: '2026-10-06T10:00:00Z', ...over }) as never;
const firing = (id: string) => ({ id, transitionId: 'submit', fromState: 'init', toState: 'review', startedAt: '2026-10-06T10:00:00Z', triggerType: 'manual', createdAt: 'x', body: { amount: 5 } }) as never;

describe('StateExecution', () => {
  it('lists the tasks that ran for the state from the journal', () => {
    const html = renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [task('1', { hook: 'onEntry' }), task('2', { hook: 'onExit', fromState: 'review', toState: 'done' }), task('3', { toState: 'other', fromState: 'x' })] }));
    expect(html).toContain('task-1');
    expect(html).toContain('task-2');
    expect(html).not.toContain('task-3');
  });
  it('says when no task ran', () => {
    expect(renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [] }))).toContain('No tasks ran in this state');
  });
  it('defers to metrics when the runtime has them', () => {
    const html = renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [], loadMetrics: () => Promise.resolve({ success: false as const, error: { message: 'x' } }) }));
    expect(html).toContain('Loading');
  });
});

describe('TransitionExecution', () => {
  it('numbers each firing and shows the request input', () => {
    const html = renderToStaticMarkup(h(TransitionExecution, { firings: [firing('a'), firing('b')], tasks: [] }));
    expect(html).toContain('Firing 1 of 2');
    expect(html).toContain('Firing 2 of 2');
  });
  it('says when it never fired', () => {
    expect(renderToStaticMarkup(h(TransitionExecution, { firings: [], tasks: [] }))).toContain('This transition has not fired');
  });
});
