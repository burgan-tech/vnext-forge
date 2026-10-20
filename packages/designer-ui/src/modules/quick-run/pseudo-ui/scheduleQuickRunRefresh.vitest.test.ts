import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../QuickRunApi', () => ({
  getState: vi.fn(),
  getData: vi.fn(),
  getView: vi.fn(),
}));

import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import type { CorrelationInfo, StateResponse } from '../types/quickrun.types';
import { scheduleQuickRunRefresh } from './scheduleQuickRunRefresh';

const getState = QuickRunApi.getState as unknown as ReturnType<typeof vi.fn>;
const getData = QuickRunApi.getData as unknown as ReturnType<typeof vi.fn>;

const PARAMS = { domain: 'd', workflowKey: 'wf', instanceId: 'i1', runtimeUrl: '', headers: {} };
const OWN_TARGET = { domain: 'd', workflowKey: 'wf', instanceId: 'i1', via: null };
const OLD_DATA = { data: { owner: 'old' } };

const openSub: CorrelationInfo = {
  correlationId: 'corr-1',
  parentState: 's1',
  subFlowInstanceId: 'child-1',
  subFlowType: 'S',
  subFlowDomain: 'cd',
  subFlowName: 'child-flow',
  subFlowVersion: '1.0.0',
  isCompleted: false,
};
// No view source: only the data request runs.
const plain: StateResponse = { state: 's1', status: 'B' };

describe('scheduleQuickRunRefresh — data', () => {
  beforeEach(() => {
    getState.mockReset();
    getData.mockReset();
    useQuickRunStore.setState({
      activeTabId: 'i1',
      activeState: null,
      activeData: OLD_DATA,
      dataTarget: OWN_TARGET,
      etags: { data: 'etag-old' },
    });
  });

  it('reads the leaf sub-flow', async () => {
    getState.mockResolvedValueOnce({ success: true, data: { ...plain, activeCorrelations: [openSub] } });
    getData.mockResolvedValueOnce({ success: true, data: { data: { owner: 'child' }, eTag: 'etag-child' } });

    await scheduleQuickRunRefresh(PARAMS);

    expect(getData.mock.calls[0]?.[0]).toMatchObject({ domain: 'cd', workflowKey: 'child-flow', instanceId: 'child-1' });
    // The moved target dropped the parent's ETag before the request.
    expect((getData.mock.calls[0]?.[0] as { ifNoneMatch?: string }).ifNoneMatch).toBeUndefined();
    expect(useQuickRunStore.getState().activeData).toEqual({ data: { owner: 'child' }, eTag: 'etag-child' });
  });

  it('clears data and ETag when getData throws', async () => {
    getState.mockResolvedValueOnce({ success: true, data: plain });
    getData.mockRejectedValueOnce(new Error('offline'));

    await scheduleQuickRunRefresh(PARAMS);

    const s = useQuickRunStore.getState();
    expect(s.activeData).toBeNull();
    expect(s.etags.data).toBeUndefined();
  });

  it('leaves the cache alone when getData throws after the target moved', async () => {
    getState.mockResolvedValueOnce({ success: true, data: plain });
    const moved = { data: { owner: 'moved' } };
    getData.mockImplementationOnce(async () => {
      useQuickRunStore.setState({
        activeState: { ...plain, activeCorrelations: [openSub] },
        activeData: moved,
        etags: { data: 'etag-moved' },
      });
      throw new Error('offline');
    });

    await scheduleQuickRunRefresh(PARAMS);

    const s = useQuickRunStore.getState();
    expect(s.activeData).toBe(moved);
    expect(s.etags.data).toBe('etag-moved');
  });

  it('drops an answer whose target moved during the round', async () => {
    getState.mockResolvedValueOnce({ success: true, data: plain });
    getData.mockImplementationOnce(async () => {
      useQuickRunStore.setState({ activeState: { ...plain, activeCorrelations: [openSub] } });
      return { success: true, data: { data: { owner: 'parent' } } };
    });

    await scheduleQuickRunRefresh(PARAMS);

    expect(useQuickRunStore.getState().activeData).toEqual(OLD_DATA);
  });
});
