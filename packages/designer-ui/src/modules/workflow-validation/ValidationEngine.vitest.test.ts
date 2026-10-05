import { describe, expect, it } from 'vitest';
import { ALL_ENABLED } from '../schema-capabilities/SchemaCapabilities';
import { validateWorkflow } from './ValidationEngine';

/**
 * Minimal workflow that passes the structural rules, so a test can assert on
 * one rule without wading through unrelated findings.
 */
function workflowWith(attributes: Record<string, unknown>) {
  return {
    attributes: {
      startTransition: { key: 'start', target: 'review' },
      states: [
        { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'done', stateType: 3, transitions: [] },
      ],
      ...attributes,
    },
  };
}

function availableInIssues(attributes: Record<string, unknown>) {
  return validateWorkflow(workflowWith(attributes)).filter(
    (issue) => issue.rule === 'available-in-state-valid',
  );
}

describe('available-in-state-valid', () => {
  it('accepts a shared transition scoped to an existing state', () => {
    expect(
      availableInIssues({
        sharedTransitions: [{ key: 'escalate', target: 'done', availableIn: ['review'] }],
      }),
    ).toEqual([]);
  });

  it('accepts the object form when the state exists', () => {
    expect(
      availableInIssues({
        cancel: {
          key: 'cancel',
          availableIn: [{ state: 'review', roles: [{ role: 'supervisor', grant: 'allow' }] }],
        },
      }),
    ).toEqual([]);
  });

  it('warns when a shared transition names a state that does not exist', () => {
    const issues = availableInIssues({
      sharedTransitions: [{ key: 'escalate', target: 'done', availableIn: ['ghost'] }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('escalate');
    expect(issues[0].message).toContain('ghost');
  });

  it('warns for the object form too', () => {
    const issues = availableInIssues({
      exit: { key: 'exit', availableIn: [{ state: 'ghost', roles: [] }] },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Exit transition');
  });

  it('covers cancel, exit and updateData independently', () => {
    const issues = availableInIssues({
      cancel: { key: 'cancel', availableIn: ['ghost-a'] },
      exit: { key: 'exit', availableIn: ['ghost-b'] },
      updateData: { key: 'update-data', availableIn: ['ghost-c'] },
    });
    expect(issues).toHaveLength(3);
  });

  it('stays silent when availableIn is absent or empty', () => {
    expect(availableInIssues({ cancel: { key: 'cancel' } })).toEqual([]);
    expect(availableInIssues({ cancel: { key: 'cancel', availableIn: [] } })).toEqual([]);
  });
});

describe('runtime-sync rules in validateWorkflow', () => {
  it('reports a state-level SubProcess as an error on its node', () => {
    const issues = validateWorkflow(
      workflowWith({
        states: [
          { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'spawn' }] },
          {
            key: 'spawn',
            stateType: 4,
            subFlow: { type: 'P', process: { key: 'x', domain: 'core', version: '1.0.0', flow: 'sys-flows' } },
            transitions: [{ key: 'done', target: 'done' }],
          },
          { key: 'done', stateType: 3, transitions: [] },
        ],
      }),
    ).filter((issue) => issue.rule === 'subflow-state-subprocess');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', nodeId: 'spawn' });
  });
});

describe('optional Initial state (runtime 0.0.99)', () => {
  const OPTIONAL = { ...ALL_ENABLED, initialStateOptional: true };
  const LEGACY = { ...ALL_ENABLED, initialStateOptional: false };
  const noInitial = {
    attributes: {
      startTransition: { key: 'start', target: 'review' },
      states: [
        { key: 'review', stateType: 2, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'done', stateType: 3, transitions: [] },
      ],
    },
  };
  const rules = (wf: unknown, caps = OPTIONAL) => validateWorkflow(wf, caps).map((i) => `${i.severity}:${i.rule}`);

  it('only requires an Initial state on older schemas', () => {
    expect(rules(noInitial, LEGACY)).toContain('error:initial-state-required');
    expect(rules(noInitial)).not.toContain('error:initial-state-required');
  });

  it('makes a second Initial an error', () => {
    const two = workflowWith({
      states: [
        { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'other', stateType: 1, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'done', stateType: 3, transitions: [] },
      ],
    });
    expect(rules(two)).toContain('error:single-initial-state');
    expect(rules(two, LEGACY)).toContain('warning:single-initial-state');
  });

  it('reserves $start and rejects $self / $start as the start target', () => {
    const reserved = workflowWith({
      states: [
        { key: '$start', stateType: 2, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'done' }] },
        { key: 'done', stateType: 3, transitions: [] },
      ],
    });
    expect(rules(reserved)).toContain('error:reserved-state-key');
    expect(rules(workflowWith({ startTransition: { key: 'start', target: '$self' } }))).toContain('error:start-target-valid');
  });
});
