import { describe, expect, it } from 'vitest';

import type { HumanTaskItem } from '../types/quickrun.types';
import { humanTaskLabel, humanTaskOpenAction, instanceTargetFromHumanTask } from './humanTasks';

const ROW: HumanTaskItem = {
  instanceId: 'APP-1',
  id: '11111111-2222-3333-4444-555555555555',
  workflow: 'ht-a',
  title: 'Approve application',
  description: null,
  createdAt: '2026-09-20T10:00:00Z',
};

describe('humanTaskOpenAction', () => {
  it('opens the instance when the row belongs to the current workflow', () => {
    expect(humanTaskOpenAction(ROW, 'ht-a')).toBe('openInstance');
    expect(humanTaskOpenAction({ ...ROW, workflow: null }, 'ht-a')).toBe('openInstance');
  });

  it('opens the other workflow otherwise', () => {
    expect(humanTaskOpenAction(ROW, 'ht-b')).toBe('openWorkflow');
  });
});

describe('instanceTargetFromHumanTask', () => {
  it('opens the ROOT by its own id, labelled by its business key', () => {
    expect(instanceTargetFromHumanTask(ROW, 'core', 'ht-a')).toEqual({
      id: ROW.id,
      key: 'APP-1',
      domain: 'core',
      workflowKey: 'ht-a',
      status: 'A',
      effectiveStatus: 'A',
      startedAt: '2026-09-20T10:00:00Z',
    });
  });
});

describe('humanTaskLabel', () => {
  it('prefers the title, then the business key, then the id', () => {
    expect(humanTaskLabel(ROW)).toBe('Approve application');
    expect(humanTaskLabel({ ...ROW, title: '  ' })).toBe('APP-1');
    expect(humanTaskLabel({ ...ROW, title: null, instanceId: null })).toBe(ROW.id);
  });
});
