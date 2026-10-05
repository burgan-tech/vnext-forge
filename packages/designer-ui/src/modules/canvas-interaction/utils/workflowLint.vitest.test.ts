import { describe, expect, it } from 'vitest';
import { toVnextWorkflow } from './Conversion';
import { lintWorkflow } from './workflowLint';

describe('lintWorkflow — runtime-sync rules', () => {
  it('includes the human-task queryRoles warning with its state', () => {
    const findings = lintWorkflow(
      toVnextWorkflow({
        key: 'wf',
        attributes: {
          states: [
            { key: 'entry', stateType: 1, labels: [{ language: 'en', label: 'Entry' }], transitions: [{ key: 'go', target: 'ht' }] },
            { key: 'ht', stateType: 2, subType: 6, labels: [{ language: 'en', label: 'Approve' }], transitions: [{ key: 'ok', target: 'done' }] },
            { key: 'done', stateType: 3, labels: [{ language: 'en', label: 'Done' }], transitions: [] },
          ],
        },
      }),
    );
    expect(findings.filter((f) => f.rule === 'human-task-query-roles')).toEqual([
      expect.objectContaining({ severity: 'warning', stateKey: 'ht' }),
    ]);
  });
});

describe('lintWorkflow — optional Initial state (runtime 0.0.99)', () => {
  const noInitial = toVnextWorkflow({
    key: 'wf',
    attributes: {
      startTransition: { key: 'start', target: 'step-1' },
      states: [
        { key: 'step-1', stateType: 2, labels: [{ language: 'en', label: 'Step' }], transitions: [{ key: 'go', target: 'done' }] },
        { key: 'done', stateType: 3, labels: [{ language: 'en', label: 'Done' }], transitions: [] },
        { key: 'orphan', stateType: 2, labels: [{ language: 'en', label: 'Orphan' }], transitions: [{ key: 'x', target: 'done' }] },
      ],
    },
  });

  it('requires an Initial state on older schemas', () => {
    expect(lintWorkflow(noInitial).some((f) => f.rule === 'no-initial-state')).toBe(true);
  });

  it('accepts a workflow without one when the schema allows it', () => {
    expect(lintWorkflow(noInitial, { initialStateOptional: true }).some((f) => f.rule === 'no-initial-state')).toBe(false);
  });

  it('walks reachability from the start transition target', () => {
    const unreachable = lintWorkflow(noInitial, { initialStateOptional: true })
      .filter((f) => f.rule === 'unreachable-state')
      .map((f) => f.stateKey);
    expect(unreachable).toEqual(['orphan']);
  });
});

describe('lintWorkflow — task response slots', () => {
  it('flags the same task twice at one order without variableKey', () => {
    const findings = lintWorkflow(
      toVnextWorkflow({
        key: 'wf',
        attributes: {
          startTransition: { key: 'start', target: 'a' },
          states: [
            {
              key: 'a',
              stateType: 1,
              labels: [{ language: 'en', label: 'A' }],
              onEntries: [
                { order: 1, task: { key: 'spawn' } },
                { order: 1, task: { key: 'spawn' } },
                { order: 1, task: { key: 'spawn' }, variableKey: 'third' },
              ],
              transitions: [{ key: 'go', target: 'done', onExecutionTasks: [{ order: 1, task: { key: 't' }, variableKey: '9x' }] }],
            },
            { key: 'done', stateType: 3, labels: [{ language: 'en', label: 'Done' }], transitions: [] },
          ],
        },
      }),
    );
    expect(findings.filter((f) => f.rule === 'task-slot-collision')).toEqual([
      expect.objectContaining({ severity: 'error', stateKey: 'a' }),
    ]);
    expect(findings.filter((f) => f.rule === 'invalid-variable-key')).toEqual([
      expect.objectContaining({ stateKey: 'a', transitionKey: 'go' }),
    ]);
  });
});
