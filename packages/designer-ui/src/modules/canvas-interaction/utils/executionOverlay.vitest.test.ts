import { describe, expect, it } from 'vitest';

import type { ExecutionOverlay } from '../context/CanvasModeContext';
import { edgeExecutionData, edgePathOrders, nodeExecutionData, stateVisitCounts } from './executionOverlay';

const overlay = (
  rows: Array<[from: string, key: string, to: string]>,
  currentState: string | null = null,
  pathOnly = false,
): ExecutionOverlay => ({
  traversedTransitions: rows.map(([fromState, transitionId, toState]) => ({ fromState, transitionId, toState })),
  currentState,
  pathOnly,
});

const LOOP = overlay(
  [
    ['$start', 'start', 'init'],
    ['init', 'submit', 'review'],
    ['review', 'reject', 'init'],
    ['init', 'submit', 'review'],
  ],
  'review',
);

describe('stateVisitCounts', () => {
  it('counts every entry, loops included', () => {
    const counts = stateVisitCounts(LOOP);
    expect(counts.get('init')).toBe(2);
    expect(counts.get('review')).toBe(2);
    expect(counts.has('$start')).toBe(false);
  });

  it('counts a state the path leaves but never enters once', () => {
    const counts = stateVisitCounts(overlay([['a', 'go', 'b']]));
    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(1);
  });
});

describe('nodeExecutionData', () => {
  const visits = stateVisitCounts(LOOP);
  it('marks current, visited and unreachable states', () => {
    expect(nodeExecutionData('review', LOOP, visits)).toEqual({ executionStatus: 'current', visitCount: 2, pathOnly: false });
    expect(nodeExecutionData('init', LOOP, visits)?.executionStatus).toBe('visited');
    expect(nodeExecutionData('done', LOOP, visits)).toEqual({ executionStatus: 'unreachable', visitCount: 0, pathOnly: false });
  });
  it('leaves the start and workflow-level nodes alone', () => {
    expect(nodeExecutionData('__start__', LOOP, visits)).toBeNull();
    expect(nodeExecutionData('__wf_cancel', LOOP, visits)).toBeNull();
  });
  it('carries path-only through', () => {
    const o = { ...LOOP, pathOnly: true };
    expect(nodeExecutionData('done', o, stateVisitCounts(o))?.pathOnly).toBe(true);
  });
});

describe('edgeExecutionData', () => {
  const orders = edgePathOrders(LOOP);
  it('numbers each firing of an edge, oldest first', () => {
    expect(edgeExecutionData('init', 'submit', orders, LOOP)).toEqual({ executionStatus: 'traversed', pathOrder: [2, 4], pathOnly: false });
  });
  it('maps the runtime $start row onto the start edge', () => {
    expect(edgeExecutionData('__start__', 'start', orders, LOOP).pathOrder).toEqual([1]);
  });
  it('does not light up the same key leaving another state', () => {
    expect(edgeExecutionData('review', 'submit', orders, LOOP).executionStatus).toBe('untaken');
  });
  it('matches workflow-level edges by key alone', () => {
    const o = overlay([['review', 'cancel', 'cancelled']]);
    expect(edgeExecutionData('__wf_cancel', 'cancel', edgePathOrders(o), o).pathOrder).toEqual([1]);
  });
  it('treats an edge without a key as untaken', () => {
    expect(edgeExecutionData('init', undefined, orders, LOOP)).toEqual({ executionStatus: 'untaken', pathOrder: [], pathOnly: false });
  });
});

describe('focus', () => {
  it('spotlights the focused state and only that one', () => {
    const o: ExecutionOverlay = { ...LOOP, focus: { kind: 'state', key: 'init' } };
    const visits = stateVisitCounts(o);
    expect(nodeExecutionData('init', o, visits)?.spotlight).toBe(true);
    expect(nodeExecutionData('review', o, visits)).not.toHaveProperty('spotlight');
  });
  it('spotlights every edge of the focused transition key', () => {
    const o: ExecutionOverlay = { ...LOOP, focus: { kind: 'transition', key: 'submit' } };
    expect(edgeExecutionData('init', 'submit', edgePathOrders(o), o).spotlight).toBe(true);
    expect(edgeExecutionData('review', 'reject', edgePathOrders(o), o)).not.toHaveProperty('spotlight');
  });
});

describe('faults', () => {
  it('flags faulted and incident states only when listed', () => {
    const o: ExecutionOverlay = { ...LOOP, faultedStates: ['init'], incidentStates: ['init'] };
    const visits = stateVisitCounts(o);
    expect(nodeExecutionData('init', o, visits)).toMatchObject({ faulted: true, hasActiveIncident: true });
    expect(nodeExecutionData('review', o, visits)).not.toHaveProperty('faulted');
  });
});
