import { beforeEach, describe, expect, it } from 'vitest';

import { useQuickRunStore } from '../store/quickRunStore';
import type { CorrelationInfo, StateResponse } from '../types/quickrun.types';
import { currentDataTarget } from './currentDataTarget';

const own = { domain: 'core', workflowKey: 'parent-flow', instanceId: 'parent-1' };

const sub = (overrides: Partial<CorrelationInfo>): CorrelationInfo => ({
  correlationId: 'c',
  parentState: 'kyc',
  subFlowInstanceId: 'child-1',
  subFlowType: 'S',
  subFlowDomain: 'kyc',
  subFlowName: 'kyc-child',
  subFlowVersion: '1.0.0',
  isCompleted: false,
  ...overrides,
});

const state = (activeCorrelations?: CorrelationInfo[]): StateResponse => ({
  state: 's1',
  status: 'A',
  ...(activeCorrelations ? { activeCorrelations } : {}),
});

describe('currentDataTarget', () => {
  beforeEach(() => useQuickRunStore.setState({ activeState: null, dataTarget: null }));

  it('is the instance itself before any state round', () => {
    expect(currentDataTarget(own)).toEqual({ ...own, via: null });
  });

  it('reads the leaf open SubFlow from the latest activeState', () => {
    const leaf = sub({ subFlowInstanceId: 'child-2', subFlowName: 'leaf', subFlowDomain: 'leafd' });
    useQuickRunStore.setState({ activeState: state([sub({}), leaf]) });
    expect(currentDataTarget(own)).toEqual({ domain: 'leafd', workflowKey: 'leaf', instanceId: 'child-2', via: leaf });
  });

  it('ignores the store dataTarget (it only tracks resets and labels)', () => {
    useQuickRunStore.setState({
      activeState: state([]),
      dataTarget: { domain: 'x', workflowKey: 'y', instanceId: 'z', via: null },
    });
    expect(currentDataTarget(own)).toEqual({ ...own, via: null });
  });
});
