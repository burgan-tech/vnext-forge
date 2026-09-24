import { describe, expect, it } from 'vitest';

import type { InstanceListItem } from '../types/quickrun.types';
import { instanceTargetFromListItem } from './instanceTarget';

const ITEM: InstanceListItem = {
  id: 'i1',
  key: 'k1',
  flow: 'wf',
  domain: 'core',
  metadata: {
    currentState: 'in-subflow',
    effectiveState: 'child-state',
    status: 'B',
    effectiveStatus: 'A',
    createdAt: '2026-09-01T00:00:00Z',
  },
};

describe('instanceTargetFromListItem', () => {
  it('keeps the raw status for behaviour and the effective one for display', () => {
    expect(instanceTargetFromListItem(ITEM)).toEqual({
      id: 'i1',
      key: 'k1',
      domain: 'core',
      workflowKey: 'wf',
      status: 'B',
      effectiveStatus: 'A',
      currentState: 'in-subflow',
      startedAt: '2026-09-01T00:00:00Z',
    });
  });

  it('omits effectiveStatus on older runtimes', () => {
    const { effectiveStatus: _ignored, ...metadata } = ITEM.metadata;
    expect(instanceTargetFromListItem({ ...ITEM, metadata })).not.toHaveProperty('effectiveStatus');
  });
});
