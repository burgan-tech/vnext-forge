import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as QuickRunApi from '../QuickRunApi';
import { createSubInstanceLoader, subInstanceHostOf } from './createSubInstanceLoader';
import { forwardDelegateMethods } from './forwardDelegateMethods';

vi.mock('../QuickRunApi', () => ({ getState: vi.fn(), getData: vi.fn() }));

const getState = vi.mocked(QuickRunApi.getState);
const getData = vi.mocked(QuickRunApi.getData);

function corr(over: Record<string, unknown>) {
  return {
    correlationId: 'c',
    parentState: 'review',
    subFlowInstanceId: 'i1',
    subFlowType: 'S',
    subFlowDomain: 'dom',
    subFlowName: 'ns-notify',
    subFlowVersion: '1.0.0',
    isCompleted: false,
    currentState: 'waiting',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function stateWith(correlations: unknown[], key: 'correlations' | 'activeCorrelations' = 'correlations') {
  getState.mockResolvedValue({ success: true, data: { [key]: correlations } } as never);
}

const input = { domain: 'dom', workflow: 'parent', instanceId: 'p1', states: ['review'], flows: ['ns-notify'] };
const load = () => createSubInstanceLoader({ getHeaders: () => ({ a: 'b' }), runtimeUrl: 'http://rt' });

beforeEach(() => {
  getState.mockReset();
  getData.mockReset();
  getData.mockImplementation((async (p: { instanceId: string }) => ({
    success: true,
    data: { data: { id: p.instanceId } },
  })) as never);
});

describe('createSubInstanceLoader', () => {
  it('returns only the requested roots', async () => {
    stateWith([
      corr({ subFlowInstanceId: 'keep-p', subFlowType: 'P' }),
      corr({ subFlowInstanceId: 'keep-s', parentState: 'review', subFlowName: 'other' }),
      corr({ subFlowInstanceId: 'drop-s', parentState: 'elsewhere', subFlowName: 'other' }),
      corr({ subFlowInstanceId: 'drop-p', subFlowType: 'P', subFlowName: 'other' }),
    ]);
    const refs = await load()(input);
    expect(refs.map((r) => r.instanceId).sort()).toEqual(['keep-p', 'keep-s']);
    expect(getData).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'dom', workflowKey: 'ns-notify', headers: { a: 'b' }, runtimeUrl: 'http://rt' }),
    );
    expect(refs.find((r) => r.instanceId === 'keep-p')).toMatchObject({
      flow: 'ns-notify', domain: 'dom', version: '1.0.0', type: 'P', parentState: 'review',
      state: 'waiting', isCompleted: false, data: { id: 'keep-p' },
    });
  });

  it('orders newest first', async () => {
    stateWith([
      corr({ subFlowInstanceId: 'old', subFlowType: 'P', createdAt: '2026-01-01T00:00:00Z' }),
      corr({ subFlowInstanceId: 'none', subFlowType: 'P', createdAt: undefined }),
      corr({ subFlowInstanceId: 'new', subFlowType: 'P', createdAt: '2026-02-01T00:00:00Z' }),
    ]);
    const refs = await load()(input);
    expect(refs.map((r) => r.instanceId)).toEqual(['new', 'old', 'none']);
  });

  it('drops a child whose data read fails', async () => {
    stateWith([
      corr({ subFlowInstanceId: 'ok', subFlowType: 'P' }),
      corr({ subFlowInstanceId: 'bad', subFlowType: 'P' }),
    ]);
    getData.mockImplementation((async (p: { instanceId: string }) =>
      p.instanceId === 'bad'
        ? { success: false, error: { code: 'X', message: 'm', traceId: 't' } }
        : { success: true, data: { data: {} } }) as never);
    const refs = await load()(input);
    expect(refs.map((r) => r.instanceId)).toEqual(['ok']);
  });

  it('prefers correlations over activeCorrelations', async () => {
    getState.mockResolvedValue({
      success: true,
      data: {
        correlations: [corr({ subFlowInstanceId: 'full', subFlowType: 'P' })],
        activeCorrelations: [corr({ subFlowInstanceId: 'active', subFlowType: 'P' })],
      },
    } as never);
    expect((await load()(input)).map((r) => r.instanceId)).toEqual(['full']);
  });

  it('falls back to activeCorrelations', async () => {
    stateWith([corr({ subFlowInstanceId: 'active', subFlowType: 'P' })], 'activeCorrelations');
    expect((await load()(input)).map((r) => r.instanceId)).toEqual(['active']);
  });

  it('returns [] when the state read fails', async () => {
    getState.mockResolvedValue({ success: false, error: { code: 'X', message: 'm', traceId: 't' } } as never);
    expect(await load()(input)).toEqual([]);
    expect(getData).not.toHaveBeenCalled();
  });
});

describe('subInstanceHostOf', () => {
  it('maps a data target to the host identity', () => {
    expect(
      subInstanceHostOf({ domain: 'd', workflowKey: 'w', instanceId: 'i', via: null }),
    ).toEqual({ domain: 'd', workflow: 'w', instanceId: 'i' });
  });
});

describe('forwardDelegateMethods', () => {
  it('forwards readFile and loadSubInstances to the base delegate', async () => {
    const readFile = vi.fn().mockResolvedValue('f');
    const loadSubInstances = vi.fn().mockResolvedValue([]);
    const fwd = forwardDelegateMethods({
      requestData: vi.fn(), loadComponent: vi.fn(), onAction: vi.fn(), readFile, loadSubInstances,
    } as never);
    await fwd.readFile!({} as never);
    await fwd.loadSubInstances!(input);
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(loadSubInstances).toHaveBeenCalledWith(input);
  });

  it('leaves optional methods undefined when the base lacks them', () => {
    const fwd = forwardDelegateMethods({ requestData: vi.fn(), loadComponent: vi.fn(), onAction: vi.fn() } as never);
    expect(fwd.readFile).toBeUndefined();
    expect(fwd.loadSubInstances).toBeUndefined();
  });
});
