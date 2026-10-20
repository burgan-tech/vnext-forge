import { describe, expect, it } from 'vitest';

import type { CorrelationInfo } from '../types/quickrun.types';
import { dataTargetKey, resolveDataTarget } from './dataTarget';

const own = { domain: 'core', workflowKey: 'parent-flow', instanceId: 'parent-1' };

const sub = (overrides: Partial<CorrelationInfo>): CorrelationInfo => ({
  correlationId: 'c',
  parentState: 'kyc',
  subFlowInstanceId: 'child-1',
  subFlowType: 'S',
  subFlowDomain: 'core',
  subFlowName: 'kyc-child',
  subFlowVersion: '1.0.0',
  isCompleted: false,
  ...overrides,
});

describe('resolveDataTarget', () => {
  it('returns the instance itself without an open SubFlow', () => {
    const state = { activeCorrelations: [sub({ subFlowType: 'P' }), sub({ isCompleted: true })] };
    expect(resolveDataTarget(own, state)).toEqual({ ...own, via: null });
    expect(resolveDataTarget(own, null)).toEqual({ ...own, via: null });
    expect(resolveDataTarget(own, undefined)).toEqual({ ...own, via: null });
  });

  it('returns the direct child for one open SubFlow', () => {
    const child = sub({ subFlowInstanceId: 'child-1', subFlowName: 'kyc-child', subFlowDomain: 'kyc' });
    expect(resolveDataTarget(own, { activeCorrelations: [child] })).toEqual({
      domain: 'kyc',
      workflowKey: 'kyc-child',
      instanceId: 'child-1',
      via: child,
    });
  });

  it('returns the leaf for a nested chain', () => {
    const childB = sub({ subFlowInstanceId: 'child-b', subFlowName: 'flow-b' });
    const proc = sub({ subFlowType: 'P', subFlowInstanceId: 'proc-x', subFlowName: 'proc-x' });
    const grandchildC = sub({ subFlowInstanceId: 'grand-c', subFlowName: 'flow-c', subFlowDomain: 'deep' });
    const target = resolveDataTarget(own, { activeCorrelations: [childB, proc, grandchildC] });
    expect(target.instanceId).toBe('grand-c');
    expect(target.workflowKey).toBe('flow-c');
    expect(target.domain).toBe('deep');
    expect(target.via).toBe(grandchildC);
  });

  it('matches subFlowType case-insensitively', () => {
    const lower = sub({ subFlowType: 's', subFlowInstanceId: 'child-lower' });
    expect(resolveDataTarget(own, { activeCorrelations: [lower] }).instanceId).toBe('child-lower');
  });
});

describe('dataTargetKey', () => {
  it('joins domain, flow and id', () => {
    expect(dataTargetKey({ domain: 'core', workflowKey: 'kyc', instanceId: 'i1' })).toBe('core/kyc/i1');
  });
});
