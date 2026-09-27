import { describe, expect, it } from 'vitest';
import {
  HUMAN_TASK_MAPPING_SNIPPET,
  hasRoleGrants,
  isHumanTaskGateMissing,
  isHumanTaskState,
  offeredTransitionsForState,
} from './humanTask';

const APPROVER = [{ role: 'ht-approver', grant: 'allow' }];

describe('isHumanTaskState', () => {
  it('is true for subType 6 on states that can wait for a person', () => {
    expect(isHumanTaskState({ stateType: 2, subType: 6 })).toBe(true);
    expect(isHumanTaskState({ stateType: 1, subType: 6 })).toBe(true);
    expect(isHumanTaskState({ stateType: 5, subType: 6 })).toBe(true);
  });

  it('is false for Final and SubFlow states and other subTypes', () => {
    expect(isHumanTaskState({ stateType: 3, subType: 6 })).toBe(false);
    expect(isHumanTaskState({ stateType: 4, subType: 6 })).toBe(false);
    expect(isHumanTaskState({ stateType: 2, subType: 5 })).toBe(false);
    expect(isHumanTaskState({ stateType: 2 })).toBe(false);
  });
});

describe('hasRoleGrants', () => {
  it('needs at least one named role', () => {
    expect(hasRoleGrants(APPROVER)).toBe(true);
    expect(hasRoleGrants([])).toBe(false);
    expect(hasRoleGrants([{ role: '  ', grant: 'allow' }])).toBe(false);
    expect(hasRoleGrants(undefined)).toBe(false);
  });
});

describe('isHumanTaskGateMissing', () => {
  it('is missing when neither the state nor the workflow declares queryRoles', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6 }, undefined)).toBe(true);
  });

  it('is satisfied by state queryRoles or the workflow root fallback', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6, queryRoles: APPROVER }, undefined)).toBe(false);
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6 }, APPROVER)).toBe(false);
  });

  it('never applies to non-human states', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 0 }, undefined)).toBe(false);
  });
});

describe('offeredTransitionsForState', () => {
  const attributes = {
    states: [
      {
        key: 'ht-a-human',
        stateType: 2,
        subType: 6,
        transitions: [
          { key: 'ht-a-approve', target: 'ht-a-completed', triggerType: 0 },
          { key: 'auto-escalate', target: 'ht-a-completed', triggerType: 1 },
          { key: 'implicit-manual', target: 'ht-a-completed' },
        ],
      },
    ],
    sharedTransitions: [
      { key: 'everywhere', target: '$self', triggerType: 0 },
      { key: 'here-only', target: '$self', triggerType: 0, availableIn: [{ state: 'ht-a-human' }] },
      { key: 'elsewhere', target: '$self', triggerType: 0, availableIn: ['other'] },
      { key: 'nightly', target: '$self', triggerType: 2 },
    ],
    cancel: { key: 'cancel', target: 'ht-a-cancelled', availableIn: ['ht-a-human'] },
    exit: { key: 'exit', target: 'ht-a-cancelled', availableIn: ['other'] },
    updateData: { key: 'update-data', target: '$self' },
  };

  it('lists manual state, shared and lifecycle transitions offered in the state', () => {
    expect(offeredTransitionsForState(attributes, 'ht-a-human')).toEqual([
      { key: 'ht-a-approve', source: 'state' },
      { key: 'implicit-manual', source: 'state' },
      { key: 'everywhere', source: 'shared' },
      { key: 'here-only', source: 'shared' },
      { key: 'cancel', source: 'cancel' },
      { key: 'update-data', source: 'updateData' },
    ]);
  });

  it('returns nothing for a malformed document', () => {
    expect(offeredTransitionsForState(null, 'x')).toEqual([]);
  });
});

describe('HUMAN_TASK_MAPPING_SNIPPET', () => {
  it('writes humanTask.title and humanTask.description into instance data', () => {
    expect(HUMAN_TASK_MAPPING_SNIPPET).toContain('humanTask.title');
    expect(HUMAN_TASK_MAPPING_SNIPPET).toContain('humanTask.description');
  });
});
