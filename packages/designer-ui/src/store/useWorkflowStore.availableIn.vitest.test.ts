import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkflowStore } from './useWorkflowStore';

/**
 * Renaming or deleting a state used to leave stale keys behind in every
 * `availableIn` list, silently un-scoping (or mis-scoping) the transition.
 */
function seed() {
  useWorkflowStore.getState().setWorkflow(
    {
      attributes: {
        startTransition: { key: 'start', target: 'review' },
        states: [
          { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'done' }] },
          { key: 'done', stateType: 3, transitions: [] },
        ],
        sharedTransitions: [
          {
            key: 'escalate',
            target: 'done',
            availableIn: ['review', { state: 'done', roles: [{ role: 'x', grant: 'allow' }] }],
          },
        ],
        cancel: { key: 'cancel', target: 'done', availableIn: ['review'] },
        exit: {
          key: 'exit',
          target: 'done',
          availableIn: [{ state: 'review', roles: [{ role: 'y', grant: 'deny' }] }],
        },
      },
    },
    {},
  );
}

function attrs() {
  return (useWorkflowStore.getState().workflowJson as any).attributes;
}

describe('renameState — availableIn maintenance', () => {
  beforeEach(seed);

  it('rewrites the bare string form', () => {
    useWorkflowStore.getState().renameState('review', 'triage');
    expect(attrs().cancel.availableIn).toEqual(['triage']);
  });

  it('rewrites the object form while preserving its roles', () => {
    useWorkflowStore.getState().renameState('review', 'triage');
    expect(attrs().exit.availableIn).toEqual([
      { state: 'triage', roles: [{ role: 'y', grant: 'deny' }] },
    ]);
  });

  it('rewrites entries across shared transitions, keeping each authored form', () => {
    useWorkflowStore.getState().renameState('review', 'triage');
    expect(attrs().sharedTransitions[0].availableIn).toEqual([
      'triage',
      { state: 'done', roles: [{ role: 'x', grant: 'allow' }] },
    ]);
  });

  it('leaves unrelated entries untouched', () => {
    useWorkflowStore.getState().renameState('done', 'complete');
    expect(attrs().sharedTransitions[0].availableIn).toEqual([
      'review',
      { state: 'complete', roles: [{ role: 'x', grant: 'allow' }] },
    ]);
    expect(attrs().cancel.availableIn).toEqual(['review']);
  });
});

describe('removeState — availableIn maintenance', () => {
  beforeEach(seed);

  it('drops the deleted state in both authored forms', () => {
    useWorkflowStore.getState().removeState('review');
    expect(attrs().sharedTransitions[0].availableIn).toEqual([
      { state: 'done', roles: [{ role: 'x', grant: 'allow' }] },
    ]);
    expect(attrs().cancel.availableIn).toEqual([]);
    expect(attrs().exit.availableIn).toEqual([]);
  });

  it('leaves entries for other states in place', () => {
    useWorkflowStore.getState().removeState('done');
    expect(attrs().sharedTransitions[0].availableIn).toEqual(['review']);
    expect(attrs().cancel.availableIn).toEqual(['review']);
  });
});
