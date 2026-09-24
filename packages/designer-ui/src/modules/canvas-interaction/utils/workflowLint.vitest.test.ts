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
