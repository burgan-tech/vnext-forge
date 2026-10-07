import { describe, expect, it } from 'vitest';

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { artifactVersion, definitionDrift, diagramPathFor } from './definitionDrift';
import { buildHistoryOnlyDefinition } from './historyGraph';
import {
  describeFirings,
  describeStateVisits,
  pickLabel,
  summarizeState,
  toExecutionOverlay,
  transitionFirings,
} from './monitorPath';

const row = (i: number, fromState: string, transitionId: string, toState: string): HistoryTransition => ({
  id: `h${i}`,
  transitionId,
  fromState,
  toState,
  startedAt: `2026-10-06T10:00:0${i}Z`,
  triggerType: 'manual',
  createdAt: `2026-10-06T10:00:0${i}Z`,
});

const HISTORY = [
  row(1, '$start', 'start', 'init'),
  row(2, 'init', 'submit', 'review'),
  row(3, 'review', 'reject', 'init'),
  row(4, 'init', 'submit', 'review'),
];

describe('monitorPath', () => {
  it('turns history into an ordered overlay', () => {
    const o = toExecutionOverlay(HISTORY, 'review', true, { kind: 'state', key: 'init' });
    expect(o.traversedTransitions.map((t) => t.transitionId)).toEqual(['start', 'submit', 'reject', 'submit']);
    expect(o).toMatchObject({ currentState: 'review', pathOnly: true, focus: { kind: 'state', key: 'init' } });
  });

  it('summarizes visits', () => {
    expect(describeStateVisits(summarizeState(HISTORY, 'review', 'review'))).toBe('Visited 2× · now here');
    expect(describeStateVisits(summarizeState(HISTORY, 'done', 'review'))).toBe('Not visited');
    expect(describeStateVisits(summarizeState([], 'init', 'init'))).toBe('Now here');
    expect(describeStateVisits(summarizeState([row(1, '$start', 'start', 'init')], 'init', null))).toBe('Visited once');
  });

  it('counts firings', () => {
    expect(transitionFirings(HISTORY, 'submit')).toHaveLength(2);
    expect(describeFirings(0)).toBe('Not fired');
    expect(describeFirings(1)).toBe('Fired once');
    expect(describeFirings(3)).toBe('Fired 3×');
  });

  it('prefers the en-US label, then the first, then the fallback', () => {
    expect(pickLabel([{ language: 'tr-TR', label: 'Onay' }, { language: 'en-US', label: 'Approve' }], 'k')).toBe('Approve');
    expect(pickLabel([{ language: 'tr-TR', label: 'Onay' }], 'k')).toBe('Onay');
    expect(pickLabel(undefined, 'k')).toBe('k');
  });
});

describe('buildHistoryOnlyDefinition', () => {
  it('draws the states and transitions seen in history', () => {
    const vm = normalizeDefinition(buildHistoryOnlyDefinition('loan', HISTORY));
    expect(vm.states.map((s) => s.key)).toEqual(['init', 'review']);
    expect(vm.states[0].stateType).toBe(1);
    expect(vm.states[0].transitions.map((t) => `${t.key}->${t.target}`)).toEqual(['submit->review']);
    expect(vm.states[1].transitions.map((t) => `${t.key}->${t.target}`)).toEqual(['reject->init']);
  });

  it('falls back to the first fromState as the start when history has no $start row', () => {
    const vm = normalizeDefinition(buildHistoryOnlyDefinition('loan', [row(1, 'a', 'go', 'b')]));
    expect(vm.states.find((s) => s.key === 'a')?.stateType).toBe(1);
  });
});

describe('definitionDrift', () => {
  it('compares artifact versions only', () => {
    expect(artifactVersion('1.2.0-pkg.1.17.0+core')).toBe('1.2.0');
    expect(definitionDrift('1.2.0', '1.2.0-pkg.1.17.0+core')).toBeNull();
    expect(definitionDrift('1.2.0', '1.1.0-pkg.1.16.0+core')).toEqual({ localVersion: '1.2.0', instanceVersion: '1.1.0' });
    expect(definitionDrift(undefined, '1.1.0')).toBeNull();
  });

  it('derives the diagram path next to the workflow', () => {
    expect(diagramPathFor('/ws/core/Workflows/loan/loan-flow.json')).toBe('/ws/core/Workflows/loan/.meta/loan-flow.diagram.json');
    expect(diagramPathFor('C:\\ws\\Workflows\\a.json')).toBe('C:/ws/Workflows/.meta/a.diagram.json');
  });
});
