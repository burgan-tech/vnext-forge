import { useCallback, useRef } from 'react';

import { createLogger } from '../../../lib/logger/createLogger';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';

const logger = createLogger('quick-run-polling');

interface PollingConfig {
  retryCount: number;
  intervalMs: number;
}

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  retryCount: 15,
  intervalMs: 4000,
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
        patchActiveState,
        setActiveStateLoading,
        setActiveStateError,
        updateInstanceState,
        updateInstanceStatus,
        setPollingInstanceId,
        setStateView,
        setStateViewLoading,
        setStateViewError,
        setLongPollAck,
      } = store.getState();

      setPollingInstanceId(params.instanceId);
      setActiveStateLoading(true);
      // Clear any prior poll error so the banner doesn't linger from
      // a previous instance / round.
      setActiveStateError(null);
      // Clear any prior long-poll acknowledge note before a new round.
      setLongPollAck(null);
      setStateView(null);
      setStateViewError(false);
      // Show the View panel skeleton from the moment we kick off the
      // state poll — earlier this flag was only flipped on once
      // `fetchStateView` itself started, so users saw nothing during
      // the (potentially long) `getState` round-trip. The flag is
      // cleared on every terminal path below: poll failure, poll
      // success with no view, abort, and inside `fetchStateView`.
      setStateViewLoading(true);

      for (let attempt = 0; attempt < config.retryCount; attempt++) {
        if (controller.signal.aborted) break;

        let response;
        try {
          response = await QuickRunApi.getState(params);
        } catch (err) {
          setActiveStateLoading(false);
          setStateViewLoading(false);
          setPollingInstanceId(null);
          setActiveStateError({
            code: 'THROWN',
            message: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
        if (controller.signal.aborted) break;

        if (response.success) {
          const stateData = response.data;

          // The engine can ask the client to stop the long-poll loop
          // regardless of instance status via
          // `interaction.terminateLongPoll`. Treat it as a stop signal.
          const terminate = stateData.interaction?.terminateLongPoll === true;
          const isTerminalStatus =
            stateData.status === 'A' || stateData.status === 'C' || stateData.status === 'F';
          const shouldStop = isTerminalStatus || terminate;

          if (stateData.status === 'B' && !shouldStop) {
            patchActiveState({ status: stateData.status, state: stateData.state });
            updateInstanceStatus(params.instanceId, stateData.status, stateData.state);
          } else {
            // Full state set on stop so transitions/view are available
            // even when terminate fired while status was still 'B'.
            setActiveState(stateData);
            updateInstanceState(params.instanceId, stateData);
          }

          if (shouldStop) {
            setActiveStateLoading(false);
            setPollingInstanceId(null);

            const canRenderView =
              !!stateData.view?.hasView &&
              (stateData.status === 'A' || stateData.status === 'C' || terminate);
            if (canRenderView) {
              // fetchStateView keeps the loading flag on until its
              // own response resolves.
              void fetchStateView(params, controller.signal);
            } else {
              // Stop with no view to fetch — drop the loading flag now
              // so the panel collapses cleanly.
              setStateViewLoading(false);
            }

            // Silently acknowledge the terminated long poll in the
            // background when the engine included an ack descriptor.
            // The endpoint is deterministic (built host-side from the
            // workflow identifiers). Failures are logged only — never
            // surfaced as an error banner.
            if (terminate && stateData.interaction?.ack) {
              void acknowledgeLongPoll(params);
            }

            return stateData;
          }

          if (attempt < config.retryCount - 1) {
            await sleep(config.intervalMs);
          }
        } else {
          // Surface the engine-side failure (e.g. 403 with
          // `forbidden.Authorization:110001` for missing role
          // permissions) so the user sees why polling stopped
          // instead of staring at a quietly empty panel.
          setActiveStateLoading(false);
          setStateViewLoading(false);
          setPollingInstanceId(null);
          setActiveStateError({
            code: response.error.code,
            message: response.error.message,
            details: response.error.details,
          });
          return null;
        }
      }

      setActiveStateLoading(false);
      setStateViewLoading(false);
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
      runtimeUrl?: string;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const {
        setActiveState,
        setActiveStateLoading,
        setActiveStateError,
        updateInstanceState,
        setStateView,
        setStateViewLoading,
        setStateViewError,
      } = store.getState();

      setActiveStateLoading(true);
      setActiveStateError(null);
      setStateView(null);
      setStateViewError(false);
      // Same rationale as in `pollState` above: show the View panel
      // skeleton up front and clear the flag on every terminal path.
      setStateViewLoading(true);

      let response;
      try {
        response = await QuickRunApi.getState(params);
      } catch (err) {
        setActiveStateLoading(false);
        setStateViewLoading(false);
        setActiveStateError({
          code: 'THROWN',
          message: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
      if (controller.signal.aborted) {
        setStateViewLoading(false);
        return null;
      }

      if (response.success) {
        const stateData = response.data;
        setActiveState(stateData);
        updateInstanceState(params.instanceId, stateData);
        setActiveStateLoading(false);

        if (stateData.view?.hasView && (stateData.status === 'A' || stateData.status === 'C')) {
          // fetchStateView owns the loading flag from here on.
          void fetchStateView(params, controller.signal);
        } else {
          // No view payload to fetch — drop the loading flag now so
          // the panel collapses without flashing a skeleton forever.
          setStateViewLoading(false);
        }
        return stateData;
      }

      setActiveStateLoading(false);
      setStateViewLoading(false);
      setActiveStateError({
        code: response.error.code,
        message: response.error.message,
        details: response.error.details,
      });
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
  params: { domain: string; workflowKey: string; instanceId: string; headers?: Record<string, string>; runtimeUrl?: string },
  signal: AbortSignal,
): Promise<void> {
  const { setStateView, setStateViewLoading, setStateViewError } =
    useQuickRunStore.getState();
  setStateViewLoading(true);
  setStateViewError(false);

  // The loading flag has to be cleared on EVERY exit (success,
  // engine error, network throw, and signal abort). The previous
  // implementation returned early on `signal.aborted` without
  // touching the flag — a subsequent pollState that hit a no-view
  // terminal state then never re-set it, leaving the View panel
  // stuck on "Loading view…" indefinitely.
  try {
    const viewResponse = await QuickRunApi.getView({
      domain: params.domain,
      workflowKey: params.workflowKey,
      instanceId: params.instanceId,
      headers: params.headers,
      runtimeUrl: params.runtimeUrl,
    });

    if (signal.aborted) return;

    if (viewResponse.success) {
      setStateView(viewResponse.data);
    } else {
      setStateViewError(true);
      setStateView(null);
    }
  } catch {
    if (signal.aborted) return;
    setStateViewError(true);
    setStateView(null);
  } finally {
    setStateViewLoading(false);
  }
}

/**
 * Fire-and-forget acknowledge of a terminated long poll. Surfaces an
 * "acknowledging" → "acknowledged" status to the user; any failure is
 * logged only (never an error banner) and still ends in "acknowledged"
 * so the user sees the interaction completed from the client side.
 */
async function acknowledgeLongPoll(params: {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): Promise<void> {
  const { setLongPollAck } = useQuickRunStore.getState();
  setLongPollAck('acknowledging');
  try {
    const res = await QuickRunApi.acknowledgeLongPoll({
      domain: params.domain,
      workflowKey: params.workflowKey,
      instanceId: params.instanceId,
      headers: params.headers,
      runtimeUrl: params.runtimeUrl,
    });
    if (!res.success) {
      logger.warn('Long-poll acknowledge failed', {
        instanceId: params.instanceId,
        code: res.error.code,
        message: res.error.message,
      });
    } else if (!res.data.ok) {
      logger.warn('Long-poll acknowledge returned non-2xx', {
        instanceId: params.instanceId,
        status: res.data.status,
      });
    }
  } catch (err) {
    logger.warn('Long-poll acknowledge threw', {
      instanceId: params.instanceId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    setLongPollAck('acknowledged');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
