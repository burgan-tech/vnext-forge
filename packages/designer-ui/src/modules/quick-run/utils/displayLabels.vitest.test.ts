import { describe, expect, it } from 'vitest';

import type { FlowLabelsMap } from '../types/quickrun.types';
import {
  normalizeTimeoutTarget,
  stateDisplayLabel,
  targetDisplayLabel,
  transitionDisplayLabel,
} from './displayLabels';
import { extractLabelsMap } from './extractLabelsMap';

const flow = {
  attributes: {
    labels: [{ language: 'en-US', label: 'Loan' }],
    startTransition: { key: 'start', labels: [{ language: 'en-US', label: 'Start' }] },
    states: [
      {
        key: 'a',
        labels: [{ language: 'tr-TR', label: 'A TR' }],
        transitions: [{ key: 'next', labels: [{ language: 'en-US', label: 'Next from A' }] }],
      },
      {
        key: 'b',
        labels: [{ language: 'en-US', label: 'B' }],
        transitions: [{ key: 'next', labels: [{ language: 'en-US', label: 'Next from B' }] }],
      },
    ],
    sharedTransitions: [{ key: 'shared', labels: [{ language: 'en-US', label: 'Shared' }] }],
    cancel: { key: 'cancel', labels: [{ language: 'en-US', label: 'Cancel it' }] },
    timeout: { key: 'abandon', labels: [{ language: 'en-US', label: 'Abandon' }] },
  },
};

describe('extractLabelsMap', () => {
  const map = extractLabelsMap(flow);

  it('covers shared, cancel and timeout transitions', () => {
    expect(map.transitions.shared).toBe('Shared');
    expect(map.transitions.cancel).toBe('Cancel it');
    expect(map.transitions.abandon).toBe('Abandon');
    expect(map.transitions.start).toBe('Start');
  });

  it('keys state transitions by state so a reused key does not collide', () => {
    expect(map.stateTransitions?.['a/next']).toBe('Next from A');
    expect(map.stateTransitions?.['b/next']).toBe('Next from B');
  });

  it('falls back to the first label when en-US is missing', () => {
    expect(map.states.a).toBe('A TR');
  });
});

describe('display labels', () => {
  const map: FlowLabelsMap = extractLabelsMap(flow);

  it('prefers runtime labels, then the state-scoped local label, then the key', () => {
    expect(transitionDisplayLabel({ name: 'next', labels: [{ language: 'en-US', label: 'Runtime' }] }, map, 'a')).toBe(
      'Runtime',
    );
    expect(transitionDisplayLabel({ name: 'next' }, map, 'a')).toBe('Next from A');
    expect(transitionDisplayLabel({ name: 'unknown' }, map, 'a')).toBe('unknown');
    expect(transitionDisplayLabel({ name: 'next' }, null)).toBe('next');
  });

  it('names the implicit $start state', () => {
    expect(stateDisplayLabel('$start', map)).toBe('Starting…');
    expect(stateDisplayLabel('b', map, [{ language: 'en-US', label: 'B runtime' }])).toBe('B runtime');
  });

  it('normalizes the old string and the new object timeout target', () => {
    expect(normalizeTimeoutTarget({ target: 'cancelled' })).toEqual({ key: 'cancelled' });
    const obj = { key: 'cancelled', stateType: 'finish', labels: [{ language: 'en-US', label: 'Cancelled' }] };
    expect(normalizeTimeoutTarget({ target: obj })).toBe(obj);
    expect(targetDisplayLabel(obj, map)).toBe('Cancelled');
  });
});
