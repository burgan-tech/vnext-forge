import { useCallback, useRef } from 'react';

import { createLogger } from '../../../lib/logger/createLogger';
import { extractEtag } from '../etagFromResponse';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { decideDataOutcome } from './decideDataOutcome';
import { resolveStateViewSource } from './resolveStateViewSource';
import { stateViewContentChanged } from './stateViewContentChanged';
import type { StateResponse } from '../types/quickrun.types';

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
      // earlier this flag was only flipped on once the view fetch
      // itself started, so users saw nothing during the (potentially
      // long) initial `getState` round-trip. The flag is cleared on
      // every terminal path below: poll failure, poll success with no
      // view, abort, and inside `refreshViewAndData`'s view branch.
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
            //
            // View and Data are separate resources from State and must
            // still refresh independently on this tick — a 304 on State
            // says nothing about whether the instance's Data changed (Data
            // has its own ETag) or, in the rare case a view is already
            // eligible to render, whether its content changed (View has no
            // ETag, so it's always fetched unconditionally and diffed
            // client-side). `effectiveState` is the currently-cached
            // activeState from a prior round, never the (absent) 304 body.
            const effectiveState = store.getState().activeState;
            if (effectiveState && !controller.signal.aborted) {
              await refreshViewAndData(params, effectiveState, false, controller.signal);
            }

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
            if (!canRenderView) {
              // Stop with no view to fetch — drop the loading flag now
              // so the panel collapses cleanly. (When a view IS eligible,
              // refreshViewAndData below owns the loading flag until its
              // own response resolves.)
              setStateViewLoading(false);
            }
            // Fire-and-forget, same as the previous inline view fetch
            // this replaces — the return below must not wait on it. Also
            // covers the Data refresh that previously only happened via
            // the separate post-transition `scheduleQuickRunRefresh`, now
            // folded into every poll tick (including this stop tick).
            void refreshViewAndData(params, stateData, terminate, controller.signal);

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

          // Non-stop 200 (still busy): View/Data are independent resources
          // and must refresh on this tick too. In practice `canRenderView`
          // inside refreshViewAndData will be false here (busy states don't
          // expose a view per the same status gate as above), so this is
          // effectively a Data-only refresh during the busy phase — but it
          // still runs the same shared, signal-guarded step for consistency.
          if (!controller.signal.aborted) {
            await refreshViewAndData(params, stateData, terminate, controller.signal);
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
          // View/Data are independent resources and still refresh on this
          // tick (same rationale as pollState's 304 branch).
          setActiveStateLoading(false);
          const effectiveState = store.getState().activeState;
          if (effectiveState && !controller.signal.aborted) {
            void refreshViewAndData(params, effectiveState, false, controller.signal);
          }
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
        const canRenderView = !!viewSource && (stateData.status === 'A' || stateData.status === 'C');
        if (!canRenderView) {
          // No view payload to fetch — drop the loading flag now so
          // the panel collapses without flashing a skeleton forever.
          // (When a view IS eligible, refreshViewAndData below owns the
          // loading flag until its own response resolves.)
          setStateViewLoading(false);
        }
        // Also refreshes Data on this tick — folded into the same shared
        // step the poll loop uses. `terminate` is always false here: this
        // single-shot tab-switch fetch has no long-poll interaction concept.
        void refreshViewAndData(params, stateData, false, controller.signal);
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

/**
 * Refreshes View and Data for `effectiveState` — the two resources are
 * independent of State (no shared ETag/cache-invalidation relationship)
 * and, per product decision, must be (re)queried on every poll tick
 * regardless of whether that tick's State response was a 200 or a 304.
 * `effectiveState` is whichever state is currently in effect for this
 * tick: the freshly-returned `stateData` on a State 200, or the
 * previously-cached `activeState` on a State 304 (never mutated here —
 * callers own State-side store updates).
 *
 * - Data: conditional request against its own cached ETag
 *   (`etags.data`), independent of the State ETag. 200 -> update
 *   `activeData` + capture the new ETag; 304 -> keep `activeData`
 *   as-is; failure -> clear both `activeData` and `etags.data` (mirrors
 *   the existing self-heal pattern in `scheduleQuickRunRefresh`).
 * - View: has no ETag (product decision), so it is always fetched
 *   unconditionally when `resolveStateViewSource` + the status gate
 *   (status A/C, or `terminate`) say a view is eligible for this state.
 *   The fetched content is only written to the store when it actually
 *   differs from what's currently shown (`stateViewContentChanged`),
 *   so an unchanged view doesn't re-mount the pseudo-ui iframe on every
 *   ~4s tick. When no view is eligible, this function does not touch
 *   `stateView` at all — callers that need to clear it on a genuine
 *   State 200 (vs. preserve it on a 304) do that themselves before or
 *   around calling this.
 *
 * All store writes are guarded by `signal` so a superseded poll (a new
 * `pollState`/`fetchInstanceState` call aborts the previous one) never
 * writes stale View/Data after the fact.
 */
async function refreshViewAndData(
  params: { domain: string; workflowKey: string; instanceId: string; headers?: Record<string, string>; runtimeUrl?: string },
  effectiveState: StateResponse,
  terminate: boolean,
  signal: AbortSignal,
): Promise<void> {
  const base = {
    domain: params.domain,
    workflowKey: params.workflowKey,
    instanceId: params.instanceId,
    headers: params.headers,
    runtimeUrl: params.runtimeUrl,
  };

  const dataRefresh = (async () => {
    const { etags, setActiveData, setEtag } = useQuickRunStore.getState();
    let dataRes;
    try {
      dataRes = await QuickRunApi.getData({ ...base, ifNoneMatch: etags.data });
    } catch {
      if (signal.aborted) return;
      setActiveData(null);
      setEtag('data', undefined);
      return;
    }
    if (signal.aborted) return;

    const outcome = decideDataOutcome(dataRes);
    if (outcome.kind === 'update') {
      setActiveData(outcome.data);
      setEtag('data', outcome.etag);
    } else if (outcome.kind === 'clear') {
      setActiveData(null);
      setEtag('data', undefined);
    }
    // 'keep' (304): leave `activeData` untouched.
  })();

  const viewSource = resolveStateViewSource(effectiveState);
  const canRenderView =
    !!viewSource && (effectiveState.status === 'A' || effectiveState.status === 'C' || terminate);

  const viewRefresh = canRenderView
    ? (async () => {
        const { setStateView, setStateViewLoading, setStateViewError } = useQuickRunStore.getState();
        setStateViewLoading(true);
        setStateViewError(false);

        // The loading flag has to be cleared on EVERY exit (success,
        // engine error, network throw, and signal abort) — see the
        // history note above `refreshViewAndData` for why an early
        // abort-return without clearing it previously left the View
        // panel stuck on "Loading view…" indefinitely.
        try {
          const viewResponse = await QuickRunApi.getView({ ...base, transitionKey: viewSource?.transitionKey });

          if (signal.aborted) return;

          if (viewResponse.success) {
            const current = useQuickRunStore.getState().stateView;
            if (stateViewContentChanged(current, viewResponse.data)) {
              setStateView(viewResponse.data);
            }
            setStateViewError(false);
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
      })()
    : Promise.resolve();

  await Promise.all([dataRefresh, viewRefresh]);
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
