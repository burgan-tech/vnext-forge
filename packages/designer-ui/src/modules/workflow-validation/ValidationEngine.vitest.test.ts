import { describe, expect, it } from 'vitest';
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
