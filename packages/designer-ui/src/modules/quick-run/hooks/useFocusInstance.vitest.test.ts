import { describe, expect, it } from 'vitest';

import type { InstanceDetailResponse } from '../QuickRunApi';
import { targetFromInstanceDetail } from './useFocusInstance';

describe('targetFromInstanceDetail', () => {
  it('maps an instance detail to an open target', () => {
    const detail = {
      id: 'i1', key: 'order-1', flow: 'loan', domain: 'core',
      metadata: { currentState: 'review', effectiveState: 'review', status: 'A', effectiveStatus: 'B', createdAt: '2026-10-06T10:00:00Z' },
    } as InstanceDetailResponse;
    expect(targetFromInstanceDetail(detail, 'core', 'loan')).toEqual({
      id: 'i1', key: 'order-1', domain: 'core', workflowKey: 'loan', status: 'A', effectiveStatus: 'B', currentState: 'review', startedAt: '2026-10-06T10:00:00Z',
    });
  });
});
