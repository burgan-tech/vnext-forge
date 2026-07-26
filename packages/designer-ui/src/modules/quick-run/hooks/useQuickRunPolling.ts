import { useCallback, useRef } from 'react';

import { createLogger } from '../../../lib/logger/createLogger';
import { extractEtag } from '../etagFromResponse';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { resolveStateViewSource } from './resolveStateViewSource';

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
        setEtag,
      } = store.getState();

      setPollingInstanceId(params.instanceId);
      setActiveStateLoading(true);
      // Clear any prior poll error so the banner doesn't linger from
      // a previous instance / round.
      setActiveStateError(null);
      // Clear any prior long-poll acknowledge note before a new round.
      setLongPollAck(null);
      // `stateView` is intentionally left untouched when this instance
      // already has a cached state ETag: this pollState call may be a
      // second round on an already-rendered instance (e.g. re-polling
      // after firing a transition), and a 304 further down means that
      // cached view is still correct — clearing it here would flash the
      // panel to empty before we even know the answer. When there is no
      // cached ETag yet, a 304 is impossible on the very first attempt,
      // so it's safe (and desirable) to prime the skeleton immediately:
      // earlier this flag was only flipped on once `fetchStateView`
      // itself started, so users saw nothing during the (potentially
      // long) initial `getState` round-trip. The flag is cleared on
      // every terminal path below: poll failure, poll success with no
      // view, abort, and inside `fetchStateView`.
      if (!store.getState().etags.state) {
        setStateView(null);
        setStateViewError(false);
        setStateViewLoading(true);
      }

      for (let attempt = 0; attempt < config.retryCount; attempt++) {
        if (controller.signal.aborted) break;

        // Read fresh on every attempt (not captured once before the loop)
        // so a 304 on a later attempt echoes the ETag this same loop just
        // captured on an earlier attempt.
        const ifNoneMatch = store.getState().etags.state;

        let response;
        try {
          response = await QuickRunApi.getState({ ...params, ifNoneMatch });
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

          if (stateData.notModified) {
            // 304: the upstream state is unchanged since our last ETag.
            // No `status`/`interaction`/`state` fields are present on this
            // payload, so terminal detection, ack, and view-selection must
            // not run against it — treat this exactly like a non-advancing
            // 'B' poll and keep the currently-cached activeState/stateView
            // untouched, then retry on the next tick.
            if (attempt < config.retryCount - 1) {
              await sleep(config.intervalMs);
            }
            continue;
          }

          // Successful, non-304 response — capture the fresh ETag so the
          // next attempt (or the next poll round) can conditionally request.
          setEtag('state', extractEtag(stateData));

          // We now know there is fresh state to show. If the pre-loop
          // priming above was skipped (a cached ETag existed going in),
          // this is the first point stale view content gets cleared —
          // right as we confirm new data actually warrants it. When the
          // priming above already ran, these are harmless no-ops.
          setStateView(null);
          setStateViewError(false);
          setStateViewLoading(true);

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

            const viewSource = resolveStateViewSource(stateData);
            const canRenderView =
              !!viewSource &&
              (stateData.status === 'A' || stateData.status === 'C' || terminate);
            if (canRenderView) {
              // fetchStateView keeps the loading flag on until its
              // own response resolves.
              void fetchStateView(params, controller.signal, viewSource?.transitionKey);
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
        setEtag,
      } = store.getState();

      setActiveStateLoading(true);
      setActiveStateError(null);
      // `stateView` / `stateViewLoading` are intentionally left untouched
      // here — a 304 below means the cached view is still correct and
      // must not be wiped (or shown loading) while we wait on the
      // response. They're reset just before the actual re-fetch, once we
      // know the response is a real (non-304) state change.

      const ifNoneMatch = store.getState().etags.state;
      let response;
      try {
        response = await QuickRunApi.getState({ ...params, ifNoneMatch });
      } catch (err) {
        setActiveStateLoading(false);
        setActiveStateError({
          code: 'THROWN',
          message: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
      if (controller.signal.aborted) {
        return null;
      }

      if (response.success) {
        const stateData = response.data;

        if (stateData.notModified) {
          // 304: keep the currently-cached activeState + stateView as-is.
          setActiveStateLoading(false);
          return store.getState().activeState;
        }

        setEtag('state', extractEtag(stateData));
        setActiveState(stateData);
        updateInstanceState(params.instanceId, stateData);
        setActiveStateLoading(false);

        setStateView(null);
        setStateViewError(false);
        setStateViewLoading(true);

        const viewSource = resolveStateViewSource(stateData);
        if (viewSource && (stateData.status === 'A' || stateData.status === 'C')) {
          // fetchStateView owns the loading flag from here on.
          void fetchStateView(params, controller.signal, viewSource.transitionKey);
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
  transitionKey?: string,
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
      transitionKey,
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
