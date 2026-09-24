import { describe, expect, it } from 'vitest';
import { runtimeSyncFindings } from './runtimeSyncRules';

const wf = (attributes: Record<string, unknown>) => ({ attributes });
const rules = (attributes: Record<string, unknown>) => runtimeSyncFindings(wf(attributes)).map((f) => f.rule);

describe('runtimeSyncFindings', () => {
  it('reports a state-level SubProcess as an error on the state', () => {
    expect(runtimeSyncFindings(wf({ states: [{ key: 'spawn', stateType: 4, subFlow: { type: 'P' } }] }))).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'subflow-state-subprocess', stateKey: 'spawn' }),
    ]);
    expect(rules({ states: [{ key: 'child', stateType: 4, subFlow: { type: 'S' } }] })).toEqual([]);
  });

  it('warns about a Human state that no queryRoles gate', () => {
    expect(runtimeSyncFindings(wf({ states: [{ key: 'ht-a-human', stateType: 2, subType: 6 }] }))).toEqual([
      expect.objectContaining({ severity: 'warning', rule: 'human-task-query-roles', stateKey: 'ht-a-human' }),
    ]);
  });

  it('accepts a Human state gated by its own or the workflow queryRoles', () => {
    const grant = [{ role: 'ht-approver', grant: 'allow' }];
    expect(rules({ states: [{ key: 'h', stateType: 2, subType: 6, queryRoles: grant }] })).toEqual([]);
    expect(rules({ queryRoles: grant, states: [{ key: 'h', stateType: 2, subType: 6 }] })).toEqual([]);
    expect(rules({ states: [{ key: 'h', stateType: 3, subType: 6 }] })).toEqual([]);
  });

  it('notes that timer.reset on the workflow timeout has no effect', () => {
    const findings = runtimeSyncFindings(
      wf({ timeout: { key: 'root-abandoned', target: 'root-timedout', timer: { reset: 'never', duration: 'PT20S' } }, states: [] }),
    );
    expect(findings).toEqual([expect.objectContaining({ severity: 'info', rule: 'timeout-timer-reset-ignored' })]);
    expect(findings[0].stateKey).toBeUndefined();
    expect(findings[0].message).toContain('"never"');
  });

  it('notes timer.reset on a subflow timeout override, on the parent state', () => {
    const findings = runtimeSyncFindings(
      wf({
        states: [
          {
            key: 'parent-subflow',
            stateType: 4,
            subFlow: { type: 'S', overrides: { timeout: { key: 'k', target: 't', timer: { reset: 'never', duration: 'PT20S' } } } },
          },
        ],
      }),
    );
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'info', rule: 'timeout-timer-reset-ignored', stateKey: 'parent-subflow' }),
    ]);
  });

  it('notes a state with both automatic and scheduled transitions', () => {
    expect(
      runtimeSyncFindings(
        wf({
          states: [
            {
              key: 'waiting',
              stateType: 2,
              transitions: [
                { key: 'auto-go', target: 'done', triggerType: 1 },
                { key: 'later', target: 'done', triggerType: 2 },
              ],
            },
          ],
        }),
      ),
    ).toEqual([expect.objectContaining({ severity: 'info', rule: 'auto-and-scheduled', stateKey: 'waiting' })]);
  });

  it('returns nothing for a document that is not an object', () => {
    expect(runtimeSyncFindings(null)).toEqual([]);
  });
});
