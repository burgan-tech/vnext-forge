import { useCallback, useRef } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';

interface PollingConfig {
  retryCount: number;
  intervalMs: number;
}

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  retryCount: 12,
  intervalMs: 500,
};

export function useQuickRunPolling(config: PollingConfig = DEFAULT_POLLING_CONFIG) {
  const abortRef = useRef<AbortController | null>(null);
  const store = useQuickRunStore;

  const pollState = useCallback(
    async (params: {
      domain: string;
      workflowKey: string;
      instanceId: string;
      headers?: Record<string, string>;
      runtimeUrl?: string;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const {
        setActiveState,
        setActiveStateLoading,
        updateInstanceState,
        setPollingInstanceId,
        setStateView,
        setStateViewLoading,
        setStateViewError,
      } = store.getState();

      setPollingInstanceId(params.instanceId);
      setActiveStateLoading(true);
      setStateView(null);
      setStateViewError(false);

      for (let attempt = 0; attempt < config.retryCount; attempt++) {
        if (controller.signal.aborted) break;

        let response;
        try {
          response = await QuickRunApi.getState(params);
        } catch {
          setActiveStateLoading(false);
          setPollingInstanceId(null);
          return null;
        }
        if (controller.signal.aborted) break;

        if (response.success) {
          const stateData = response.data;
          setActiveState(stateData);
          updateInstanceState(params.instanceId, stateData);

          if (stateData.status === 'A' || stateData.status === 'C' || stateData.status === 'F') {
            setActiveStateLoading(false);
            setPollingInstanceId(null);

            if (stateData.view?.hasView && (stateData.status === 'A' || stateData.status === 'C')) {
              void fetchStateView(params, controller.signal);
            }

            return stateData;
          }

          if (attempt < config.retryCount - 1) {
            await sleep(config.intervalMs);
          }
        } else {
          setActiveStateLoading(false);
          setPollingInstanceId(null);
          return null;
        }
      }

      setActiveStateLoading(false);
      setPollingInstanceId(null);
      return store.getState().activeState;
    },
    [config.retryCount, config.intervalMs],
  );

  /**
   * Single-shot state fetch (no retry loop). Used when switching between
   * already-opened instance tabs to refresh activeState + stateView.
   */
  const fetchInstanceState = useCallback(
    async (params: {
      domain: string;
      workflowKey: string;
      instanceId: string;
      headers?: Record<string, string>;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const {
        setActiveState,
        setActiveStateLoading,
        updateInstanceState,
        setStateView,
        setStateViewError,
      } = store.getState();

      setActiveStateLoading(true);
      setStateView(null);
      setStateViewError(false);

      let response;
      try {
        response = await QuickRunApi.getState(params);
      } catch {
        setActiveStateLoading(false);
        return null;
      }
      if (controller.signal.aborted) return null;

      if (response.success) {
        const stateData = response.data;
        setActiveState(stateData);
        updateInstanceState(params.instanceId, stateData);
        setActiveStateLoading(false);

        if (stateData.view?.hasView && (stateData.status === 'A' || stateData.status === 'C')) {
          void fetchStateView(params, controller.signal);
        }
        return stateData;
      }

      setActiveStateLoading(false);
      return null;
    },
    [],
  );

  const cancelPolling = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    store.getState().setPollingInstanceId(null);
  }, []);

  return { pollState, fetchInstanceState, cancelPolling };
}

async function fetchStateView(
  params: { domain: string; workflowKey: string; instanceId: string; headers?: Record<string, string> },
  signal: AbortSignal,
): Promise<void> {
  const { setStateView, setStateViewLoading, setStateViewError } = useQuickRunStore.getState();
  setStateViewLoading(true);
  setStateViewError(false);

  try {
    const response = await QuickRunApi.getView({
      domain: params.domain,
      workflowKey: params.workflowKey,
      instanceId: params.instanceId,
      headers: params.headers,
    });

    if (signal.aborted) return;

    if (response.success) {
      setStateView(response.data);
    } else {
      setStateViewError(true);
      setStateView(null);
    }
  } catch {
    if (signal.aborted) return;
    setStateViewError(true);
    setStateView(null);
  }
  setStateViewLoading(false);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
