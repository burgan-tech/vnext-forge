import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
import type { CorrelationInfo, StateResponse } from '../types/quickrun.types';
import { runPollLoop, useQuickRunPolling } from './useQuickRunPolling';

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
    keepPolling: null,
    stateView: null,
    lastStateResponse: null,
    activeData: null,
    dataTarget: null,
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

  it('a stale round (tab switched mid-request) writes nothing but releases its own polling flag', async () => {
    const otherState: StateResponse = { state: 'other-state', status: 'A' };
    getState.mockImplementationOnce(async () => {
      // A real switch to an already-open tab: setActiveTab + the Shell's
      // single-shot fetch, which never touches pollingInstanceId (still 'i1').
      const store = useQuickRunStore.getState();
      store.setActiveTab('i2');
      store.setActiveState(otherState);
      store.setEtag('state', 'etag-i2');
      expect(store.pollingInstanceId).toBe('i1');
      return ok(busy('s1', { eTag: 'etag-i1' } as Partial<StateResponse>));
    });

    const result = await runPollLoop(PARAMS, CONFIG);

    expect(result).toBeNull();
    expect(getState).toHaveBeenCalledTimes(1);
    const s = useQuickRunStore.getState();
    expect(s.activeState).toBe(otherState);
    expect(s.etags.state).toBe('etag-i2');
    expect(s.pollingInstanceId).toBeNull();
    expect(s.lastStateResponse).toBeNull();
    expect(getData).not.toHaveBeenCalled();
  });

  it('a stale exit does not clear a polling flag that names another instance', async () => {
    getState.mockImplementationOnce(async () => {
      const store = useQuickRunStore.getState();
      store.setActiveTab('i2');
      store.setPollingInstanceId('i2');
      return ok(busy('s1'));
    });

    expect(await runPollLoop(PARAMS, CONFIG)).toBeNull();
    expect(useQuickRunStore.getState().pollingInstanceId).toBe('i2');
  });

  it('a stale exit on a thrown request also releases its own polling flag', async () => {
    getState.mockImplementationOnce(async () => {
      useQuickRunStore.getState().setActiveTab('i2');
      throw new Error('offline');
    });

    expect(await runPollLoop(PARAMS, CONFIG)).toBeNull();
    const s = useQuickRunStore.getState();
    expect(s.pollingInstanceId).toBeNull();
    expect(s.activeStateError).toBeNull();
  });

  it('starting a new loop aborts the previous one, which then writes nothing', async () => {
    let releaseFirst: (v: unknown) => void = () => undefined;
    getState.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    const first = runPollLoop(PARAMS, CONFIG);

    getState.mockResolvedValueOnce(ok(paused('s1')));
    await runPollLoop(PARAMS, CONFIG);
    const afterSecond = useQuickRunStore.getState().activeState;

    // The newer loop for the same instance is still "polling" from the
    // aborted loop's point of view — it must not release that flag.
    useQuickRunStore.getState().setPollingInstanceId('i1');
    releaseFirst(ok({ state: 'late', status: 'C' }));
    expect(await first).toBeNull();
    expect(useQuickRunStore.getState().activeState).toBe(afterSecond);
    expect(useQuickRunStore.getState().pollingInstanceId).toBe('i1');
  });

  describe('interaction terminate: false (keep polling)', () => {
    const keep = (state: string, status: StateResponse['status']): StateResponse => ({
      state,
      status,
      interaction: { terminateLongPoll: false, fallbackTimeoutSeconds: 120 },
    });

    it('does not stop on an Active instance while the window is open', async () => {
      getState
        .mockResolvedValueOnce(ok(keep('s1', 'A')))
        .mockResolvedValueOnce(ok(keep('s1', 'A')))
        .mockResolvedValueOnce(ok({ state: 's2', status: 'A' }));

      const result = await runPollLoop(PARAMS, CONFIG);

      expect(getState).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({ state: 's2', status: 'A' });
      const s = useQuickRunStore.getState();
      expect(s.keepPolling).toBeNull();
      expect(s.pollingInstanceId).toBeNull();
      expect(s.activeStateLoading).toBe(false);
    });

    it('outlives retryCount until the window closes', async () => {
      let now = 1_000_000;
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => now);
      try {
        getState.mockImplementation(async () => {
          now += 50_000;
          return ok(keep('s1', 'B'));
        });

        await runPollLoop(PARAMS, { retryCount: 1, intervalMs: 0 });

        // Window opens on the first response (t0 + 50 s → deadline + 120 s):
        // the loop keeps going past retryCount=1 until Date.now() passes it.
        expect(getState.mock.calls.length).toBeGreaterThan(1);
        expect(getState.mock.calls.length).toBeLessThanOrEqual(4);
        expect(useQuickRunStore.getState().keepPolling).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('stops at once on a terminal status', async () => {
      getState.mockResolvedValueOnce(ok(keep('s1', 'C')));
      await runPollLoop(PARAMS, CONFIG);
      expect(getState).toHaveBeenCalledTimes(1);
    });
  });

  describe('data target', () => {
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
    // A keep-polling window keeps the loop going on an Active round, so the
    // loop itself fetches Data on that round (`includeData: true`).
    const withSubFlow: StateResponse = {
      state: 's1',
      status: 'A',
      activeCorrelations: [openSub],
      interaction: { terminateLongPoll: false, fallbackTimeoutSeconds: 120 },
    };

    it('fetches data from the leaf while a sub-flow is open', async () => {
      getState.mockResolvedValueOnce(ok(withSubFlow)).mockResolvedValueOnce(ok({ state: 's2', status: 'A' }));

      await runPollLoop(PARAMS, CONFIG);

      expect(getData).toHaveBeenCalledTimes(1);
      expect(getData.mock.calls[0]?.[0]).toMatchObject({ domain: 'cd', workflowKey: 'child-flow', instanceId: 'child-1' });
      // The stop round has no open SubFlow: the target is back on the instance.
      expect(useQuickRunStore.getState().dataTarget).toEqual({ ...PARAMS, via: null });
    });

    it('records the leaf as the data target on a round with an open sub-flow', async () => {
      // Stops at once (awaiting ack) with the full state written.
      getState.mockResolvedValueOnce(ok({ ...paused('s1'), activeCorrelations: [openSub] }));
      await runPollLoop(PARAMS, CONFIG);
      expect(useQuickRunStore.getState().dataTarget).toMatchObject({
        domain: 'cd',
        workflowKey: 'child-flow',
        instanceId: 'child-1',
        via: { correlationId: 'corr-1' },
      });
    });

    it('drops a data answer whose target moved during the round', async () => {
      getState.mockResolvedValueOnce(ok(withSubFlow)).mockResolvedValueOnce(ok({ state: 's2', status: 'A' }));
      getData.mockImplementationOnce(async () => {
        // The sub-flow closes while the child's data is in flight.
        useQuickRunStore.setState({ activeState: { state: 's1', status: 'A', activeCorrelations: [] } });
        return { success: true, data: { data: { child: true }, eTag: 'etag-child' } };
      });

      // Every value `activeData` takes: the round-2 stop branch moves the
      // target and nulls `activeData` anyway, so only the history shows
      // whether the dropped answer was ever written.
      const seen: unknown[] = [];
      const unsubscribe = useQuickRunStore.subscribe((st) => seen.push(st.activeData));
      try {
        await runPollLoop(PARAMS, CONFIG);
      } finally {
        unsubscribe();
      }

      expect(getData).toHaveBeenCalledTimes(1);
      expect(seen.some((v) => (v as { data?: { child?: boolean } } | null)?.data?.child === true)).toBe(false);
      const s = useQuickRunStore.getState();
      expect(s.activeData).toBeNull();
      expect(s.etags.data).toBeUndefined();
    });

    it('a 304 single-shot fetch that went stale writes no data target', async () => {
      // Capture the hook's callbacks (SSR render runs hooks once).
      let api: ReturnType<typeof useQuickRunPolling> | null = null;
      renderToStaticMarkup(
        createElement(() => {
          api = useQuickRunPolling();
          return null;
        }),
      );
      const i2Target = { domain: 'd', workflowKey: 'wf', instanceId: 'i2', via: null };
      const i2Data = { data: { owner: 'i2' } };
      useQuickRunStore.setState({ etags: { state: 'etag-i1' } });
      getState.mockImplementationOnce(async () => {
        // Tab switch while i1's state request is in flight.
        const store = useQuickRunStore.getState();
        store.setActiveTab('i2');
        store.setActiveState({ state: 'i2-state', status: 'A' });
        store.setDataTarget(i2Target);
        store.setActiveData(i2Data);
        store.setEtag('data', 'etag-i2-data');
        return ok({ notModified: true } as StateResponse);
      });

      await api!.fetchInstanceState(PARAMS);

      const s = useQuickRunStore.getState();
      expect(getData).not.toHaveBeenCalled();
      expect(s.dataTarget).toEqual(i2Target);
      expect(s.activeData).toBe(i2Data);
      expect(s.etags.data).toBe('etag-i2-data');
    });
  });
});
