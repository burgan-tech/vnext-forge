import { describe, it, expect } from 'vitest';
import { normalizeDefinition, findState, findTransition } from './normalize';

const SEMI_FLAT = {
  key: 'wf-1',
  domain: 'core',
  version: '1.5.0',
  flow: 'sys-flows',
  type: 'F',
  tags: ['banking'],
  cancel: { key: 'cancel-workflow', target: 'terminated-state', triggerType: 0, availableIn: [] },
  exit: { key: 'exit-workflow', target: 'done', availableIn: ['a'] },
  states: [
    {
      key: 'start-state',
      stateType: 1,
      labels: [{ language: 'en-US', label: 'Start' }],
      onEntries: [{ order: 1, task: { key: 't1', domain: 'core', version: '1.0.0', flow: 'sys-tasks' } }],
      transitions: [
        { key: 'go', target: 'next-state', triggerType: 0, onExecutionTasks: [] },
      ],
    },
    { key: 'next-state', stateType: 3, transitions: [] },
  ],
};

describe('normalizeDefinition (semi-flat)', () => {
  it('extracts workflow meta including cancel/exit', () => {
    const vm = normalizeDefinition(SEMI_FLAT);
    expect(vm.workflow.key).toBe('wf-1');
    expect(vm.workflow.type).toBe('F');
    expect(vm.workflow.tags).toEqual(['banking']);
    expect(vm.workflow.cancel?.target).toBe('terminated-state');
    expect(vm.workflow.exit?.availableIn).toEqual(['a']);
  });

  it('extracts states with transitions and task refs', () => {
    const vm = normalizeDefinition(SEMI_FLAT);
    expect(vm.states.map((s) => s.key)).toEqual(['start-state', 'next-state']);
    const start = findState(vm, 'start-state')!;
    expect(start.stateType).toBe(1);
    expect(start.onEntries?.[0].ref.key).toBe('t1');
    expect(start.transitions[0].target).toBe('next-state');
    expect(start.transitions[0].from).toBe('start-state');
  });

  it('finds a transition by key with its source', () => {
    const vm = normalizeDefinition(SEMI_FLAT);
    const t = findTransition(vm, 'go')!;
    expect(t.from).toBe('start-state');
    expect(t.target).toBe('next-state');
  });

  it('produces a FlowCanvas workflowJson with attributes.states', () => {
    const vm = normalizeDefinition(SEMI_FLAT);
    const attrs = (vm.workflowJson as any).attributes;
    expect(Array.isArray(attrs.states)).toBe(true);
    expect(attrs.states[0].key).toBe('start-state');
  });
});

const FLAT = {
  key: 'wf-2',
  version: '1.0.0',
  states: [
    { key: 's1', type: 1 },
    { key: 's2', type: 3 },
  ],
  transitions: [{ key: 't', from: 's1', to: 's2', triggerType: 1 }],
};

describe('normalizeDefinition (flat)', () => {
  it('maps flat states/transitions into the view model', () => {
    const vm = normalizeDefinition(FLAT);
    const s1 = findState(vm, 's1')!;
    expect(s1.stateType).toBe(1);
    expect(s1.transitions[0].target).toBe('s2');
    expect(s1.transitions[0].triggerType).toBe(1);
  });
});
