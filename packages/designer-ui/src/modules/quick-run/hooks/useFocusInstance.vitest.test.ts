import { describe, expect, it } from 'vitest';

import type { InstanceDetailResponse } from '../QuickRunApi';
import { isFocusApplied, targetFromInstanceDetail } from './useFocusInstance';

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

describe('isFocusApplied', () => {
  it('is false until the nonce was recorded, so a cancelled attempt is retried', () => {
    expect(isFocusApplied(undefined, 1)).toBe(false);
    expect(isFocusApplied(1, 2)).toBe(false);
    expect(isFocusApplied(1, undefined)).toBe(false);
  });
  it('is true for a completed nonce', () => {
    expect(isFocusApplied(1, 1)).toBe(true);
  });
});
