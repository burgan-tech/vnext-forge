import { describe, expect, it } from 'vitest';

import type { CorrelationInfo } from '../types/quickrun.types';
import { activeSubFlowTarget } from './subFlowProxy';

const base: CorrelationInfo = {
  correlationId: 'c',
  parentState: 'kyc',
  subFlowInstanceId: 'child-1',
  subFlowType: 'S',
  subFlowDomain: 'core',
  subFlowName: 'kyc-child',
  subFlowVersion: '1.0.0',
  isCompleted: false,
};

describe('activeSubFlowTarget', () => {
  it('picks the running SubFlow and ignores SubProcesses and completed children', () => {
    expect(activeSubFlowTarget([{ ...base, subFlowType: 'P' }, { ...base, isCompleted: true }, base])).toBe(base);
    expect(activeSubFlowTarget([{ ...base, subFlowType: 'P' }])).toBeNull();
    expect(activeSubFlowTarget(undefined)).toBeNull();
  });

  it('returns the leaf of a nested chain', () => {
    const childB = { ...base, subFlowInstanceId: 'child-b' };
    const grandchildC = { ...base, subFlowInstanceId: 'grand-c', subFlowName: 'leaf-flow' };
    expect(activeSubFlowTarget([childB, { ...base, subFlowType: 'P' }, grandchildC])).toBe(grandchildC);
  });
});
