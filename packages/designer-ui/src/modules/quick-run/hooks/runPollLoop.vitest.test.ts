import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../QuickRunApi', () => ({
  getState: vi.fn(),
  getData: vi.fn(),
  getView: vi.fn(),
  acknowledgeLongPoll: vi.fn(),
}));

import * as QuickRunApi from '../QuickRunApi';
import { INITIAL_INTERACTION } from './interactionMachine';
import { useQuickRunStore } from '../store/quickRunStore';
import type { StateResponse } from '../types/quickrun.types';
import { runPollLoop } from './useQuickRunPolling';

const getState = QuickRunApi.getState as unknown as ReturnType<typeof vi.fn>;
const getData = QuickRunApi.getData as unknown as ReturnType<typeof vi.fn>;
const getView = QuickRunApi.getView as unknown as ReturnType<typeof vi.fn>;

const PARAMS = { domain: 'd', workflowKey: 'wf', instanceId: 'i1' };
const CONFIG = { retryCount: 10, intervalMs: 0 };

const busy = (state: string, extra: Partial<StateResponse> = {}): StateResponse => ({ state, status: 'B', ...extra });
const paused = (state: string): StateResponse =>
  busy(state, { interaction: { terminateLongPoll: true, fallbackTimeoutSeconds: 30, ack: { href: '/ack' } } });
const ok = (data: StateResponse) => ({ success: true as const, data });

function resetStore() {
  useQuickRunStore.setState({
    tabs: [],
    activeTabId: 'i1',
    instances: new Map(),
    activeState: null,
    activeStateLoading: false,
    activeStateError: null,
    pollingInstanceId: null,
    etags: {},
    interaction: INITIAL_INTERACTION,
    stateView: null,
    lastStateResponse: null,
  });
}

describe('runPollLoop', () => {
  beforeEach(() => {
    getState.mockReset();
    getData.mockReset();
    getView.mockReset();
    getData.mockResolvedValue({ success: true, data: { notModified: true } });
    getView.mockResolvedValue({ success: false, error: { code: 'X', message: 'no view' } });
    resetStore();
  });

  it('stops on an awaiting-ack response and opens the ack window', async () => {
    getState.mockResolvedValueOnce(ok(busy('s1'))).mockResolvedValueOnce(ok(paused('s1')));

    const result = await runPollLoop(PARAMS, CONFIG);

    expect(getState).toHaveBeenCalledTimes(2);
    expect(result?.state).toBe('s1');
    const s = useQuickRunStore.getState();
    expect(s.interaction).toMatchObject({ kind: 'awaitingAck', instanceId: 'i1', stateName: 's1' });
    expect(s.pollingInstanceId).toBeNull();
    expect(s.activeStateLoading).toBe(false);
    expect(s.activeState?.interaction?.terminateLongPoll).toBe(true);
  });

  it('after ACK_SUCCEEDED keeps polling (stale flag ignored) until the status leaves B', async () => {
    getState.mockResolvedValueOnce(ok(paused('s1')));
    await runPollLoop(PARAMS, CONFIG);
    useQuickRunStore.getState().dispatchInteraction({ type: 'ACK_SUCCEEDED', instanceId: 'i1' });
    expect(useQuickRunStore.getState().interaction).toMatchObject({ kind: 'resumed', reason: 'ack' });

    getState.mockReset();
    getState
      // The runtime's fallback job can still echo the interaction block for the same state.
      .mockResolvedValueOnce(ok(paused('s1')))
      .mockResolvedValueOnce(ok(busy('s1')))
      .mockResolvedValueOnce(ok({ state: 's2', status: 'A' }));

    const result = await runPollLoop(PARAMS, CONFIG);

    expect(getState).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ state: 's2', status: 'A' });
    const s = useQuickRunStore.getState();
    expect(s.interaction).toEqual({ kind: 'idle' });
    expect(s.activeState).toMatchObject({ state: 's2', status: 'A' });
    expect(s.pollingInstanceId).toBeNull();
  });

  it('a stale round (tab switched mid-request) writes nothing to the store', async () => {
    const otherState: StateResponse = { state: 'other-state', status: 'A' };
    getState.mockImplementationOnce(async () => {
      // The user switches to another instance while this request is in flight;
      // that instance's own round has already populated the store.
      const store = useQuickRunStore.getState();
      store.setActiveTab('i2');
      store.setActiveState(otherState);
      store.setEtag('state', 'etag-i2');
      store.setPollingInstanceId('i2');
      return ok(busy('s1', { eTag: 'etag-i1' } as Partial<StateResponse>));
    });

    const result = await runPollLoop(PARAMS, CONFIG);

    expect(result).toBeNull();
    expect(getState).toHaveBeenCalledTimes(1);
    const s = useQuickRunStore.getState();
    expect(s.activeState).toBe(otherState);
    expect(s.etags.state).toBe('etag-i2');
    expect(s.pollingInstanceId).toBe('i2');
    expect(s.lastStateResponse).toBeNull();
    expect(getData).not.toHaveBeenCalled();
  });

  it('starting a new loop aborts the previous one, which then writes nothing', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    getState.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    const first = runPollLoop(PARAMS, CONFIG);

    getState.mockResolvedValueOnce(ok(paused('s1')));
    await runPollLoop(PARAMS, CONFIG);
    const afterSecond = useQuickRunStore.getState().activeState;

    releaseFirst(ok({ state: 'late', status: 'C' }));
    expect(await first).toBeNull();
    expect(useQuickRunStore.getState().activeState).toBe(afterSecond);
  });
});
