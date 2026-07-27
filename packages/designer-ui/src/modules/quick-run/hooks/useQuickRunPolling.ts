import { useCallback, useRef } from 'react';

import { createLogger } from '../../../lib/logger/createLogger';
import { extractEtag } from '../etagFromResponse';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { decideDataOutcome } from './decideDataOutcome';
import { resolveStateViewSource } from './resolveStateViewSource';
import { shouldFetchView } from './shouldFetchView';
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
              // `pollingInstanceId` is set for the whole busy loop, so
              // ContextPanel's own Data lazy-load is suppressed here —
              // the loop is the sole Data source on this tick.
              await refreshViewAndData(
                params,
                effectiveState,
                { terminate: false, includeData: true },
                controller.signal,
              );
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
            // this replaces — the return below must not wait on it.
            // `includeData: false` here: `setActiveStateLoading(false)` +
            // `setPollingInstanceId(null)` just above unblock
            // ContextPanel's own Data lazy-load effects, so fetching Data
            // from the loop on this exact tick would race a concurrent
            // `getData` against ContextPanel's. Data at/after stop is
            // ContextPanel's job; the loop already covered Data on every
            // busy/304 tick leading up to this one.
            void refreshViewAndData(params, stateData, { terminate, includeData: false }, controller.signal);

            // Silently acknowledge the terminated long poll in the
            // background when the engine included an ack descriptor.
            // The endpoint is deterministic (built host-side from the
            // workflow identifiers). Failures are logged only — never
            // surfaced as an error banner.
            if (terminate && stateData.interaction?.ack) {
              // Once the ack resolves, do one more one-shot View fetch —
              // the engine-side state may settle further as a direct
              // result of the ack, so the view fetched moments earlier
              // (fired above, before the ack even went out) can be
              // stale. Signal-guarded like every other write in this
              // loop so a superseded poll round never lands here.
              void acknowledgeLongPoll(params).then(() => {
                if (!controller.signal.aborted) {
                  void fetchViewOnce({
                    base: {
                      domain: params.domain,
                      workflowKey: params.workflowKey,
                      instanceId: params.instanceId,
                      headers: params.headers,
                      runtimeUrl: params.runtimeUrl,
                    },
                    effectiveState: stateData,
                    signal: controller.signal,
                    applyStatusGate: true,
                    terminate,
                  });
                }
              });
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
            // `pollingInstanceId` is still set (this tick isn't stopping),
            // so ContextPanel's Data lazy-load stays suppressed — the loop
            // is the sole Data source here too.
            await refreshViewAndData(params, stateData, { terminate, includeData: true }, controller.signal);
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
            void refreshViewAndData(
              params,
              effectiveState,
              { terminate: false, includeData: true },
              controller.signal,
            );
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
        // Unlike `pollState`'s stop tick, this function never touches
        // `pollingInstanceId`, so it isn't the flag flip that suppresses
        // ContextPanel's own Data lazy-load — that pre-existing overlap is
        // unchanged by this fix and is out of scope here.
        void refreshViewAndData(params, stateData, { terminate: false, includeData: true }, controller.signal);
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

  /**
   * On-demand one-shot View refresh for the currently-active instance —
   * used by the "Retry view" button and after an explicit "Retry State"
   * round. Reads instance identity + `activeState` fresh from the store
   * (no params) so it always targets whatever instance/state is current
   * at click time, not whatever was current when the hook was invoked.
   *
   * Unlike the poll loop's view fetch, this bypasses the busy-state
   * status gate (`applyStatusGate: false`): the user is asking to
   * re-fetch a view they're already looking at, regardless of the
   * instance's current status. `resolveStateViewSource` returning
   * nothing still short-circuits to a no-op — there's nothing to
   * re-fetch. A stale guard (keyed off `activeTabId`) discards the
   * result if the user switches instance tabs while the request is in
   * flight, instead of writing a fetched view onto whatever instance
   * happens to be active by the time the response lands.
   */
  const refreshView = useCallback(async () => {
    const { domain, workflowKey, activeTabId, globalHeaders, sessionHeaders, environmentUrl, activeState } =
      store.getState();
    if (!domain || !workflowKey || !activeTabId || !activeState) return;

    const instanceId = activeTabId;
    await fetchViewOnce({
      base: {
        domain,
        workflowKey,
        instanceId,
        headers: { ...globalHeaders, ...sessionHeaders },
        runtimeUrl: environmentUrl,
      },
      effectiveState: activeState,
      applyStatusGate: false,
      isStale: () => store.getState().activeTabId !== instanceId,
    });
  }, []);

  return { pollState, fetchInstanceState, cancelPolling, refreshView };
}

/**
 * Refreshes View and (optionally) Data for `effectiveState` — the two
 * resources are independent of State (no shared ETag/cache-invalidation
 * relationship) and, per product decision, must be (re)queried on every
 * poll tick regardless of whether that tick's State response was a 200 or
 * a 304. `effectiveState` is whichever state is currently in effect for
 * this tick: the freshly-returned `stateData` on a State 200, or the
 * previously-cached `activeState` on a State 304 (never mutated here —
 * callers own State-side store updates).
 *
 * - Data: conditional request against its own cached ETag
 *   (`etags.data`), independent of the State ETag. 200 -> update
 *   `activeData` + capture the new ETag; 304 -> keep `activeData`
 *   as-is; failure -> clear both `activeData` and `etags.data` (mirrors
 *   the existing self-heal pattern in `scheduleQuickRunRefresh`). Only
 *   fetched when `includeData` is true — see below.
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
 * `includeData` exists to avoid a concurrent double-`getData` fetch at
 * the poll-stop tick: `pollState`'s `shouldStop` branch flips
 * `activeStateLoading` false and `pollingInstanceId` null synchronously,
 * right before calling this function — and those are exactly the flags
 * that un-gate `ContextPanel`'s own `loadData()` effects. If this
 * function also fetched Data on that same tick, two independent
 * `QuickRunApi.getData` calls would race for the same instance. Callers
 * pass `includeData: false` at the stop tick (View is still essential and
 * fetched there; ContextPanel/lazy-load owns Data at/after stop) and
 * `includeData: true` on busy/304 ticks, where `pollingInstanceId` keeps
 * ContextPanel's effects suppressed and the loop is the only Data source.
 *
 * All store writes are guarded by `signal` so a superseded poll (a new
 * `pollState`/`fetchInstanceState` call aborts the previous one) never
 * writes stale View/Data after the fact.
 */
async function refreshViewAndData(
  params: { domain: string; workflowKey: string; instanceId: string; headers?: Record<string, string>; runtimeUrl?: string },
  effectiveState: StateResponse,
  options: { terminate: boolean; includeData: boolean },
  signal: AbortSignal,
): Promise<void> {
  const { terminate, includeData } = options;
  const base = {
    domain: params.domain,
    workflowKey: params.workflowKey,
    instanceId: params.instanceId,
    headers: params.headers,
    runtimeUrl: params.runtimeUrl,
  };

  const dataRefresh = includeData
    ? (async () => {
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
      })()
    : Promise.resolve();

  const viewRefresh = fetchViewOnce({ base, effectiveState, signal, applyStatusGate: true, terminate });

  await Promise.all([dataRefresh, viewRefresh]);
}

/**
 * One-shot View fetch + store write, shared by every call site that
 * needs "fetch the View once": `refreshViewAndData`'s view branch (every
 * poll tick), the post-ack follow-up fetch in `pollState`'s stop branch,
 * and the on-demand `refreshView()` exposed from this hook (manual
 * "Retry view" button, post-retry-state refresh).
 *
 * Resolves the view source via `resolveStateViewSource` first — a
 * `null` result (nothing eligible to render for this state) is always a
 * no-op, regardless of `applyStatusGate`. When `applyStatusGate` is
 * true, the same busy-state gate the poll loop has always used also
 * applies: status `A`/`C`, or the caller's `terminate` flag. Callers
 * doing an on-demand refresh of an already-rendered view pass
 * `applyStatusGate: false` to skip that gate entirely.
 *
 * View has no ETag (product decision), so this always issues an
 * unconditional GET and only writes the result to the store when
 * `stateViewContentChanged` says the content actually differs — this is
 * what keeps an unchanged view from re-mounting the pseudo-ui iframe on
 * every tick / manual retry.
 *
 * `signal` (poll callers) and `isStale` (manual callers with no
 * AbortController of their own) are independent staleness checks: both
 * are consulted right after the network round-trip so a superseded
 * request never writes a stale view. The loading flag is still cleared
 * on every exit — success, engine error, network throw, `signal` abort,
 * or `isStale` — matching the pre-existing invariant that an early
 * return here must never leave the panel stuck on "Loading view…".
 */
async function fetchViewOnce({
  base,
  effectiveState,
  signal,
  applyStatusGate,
  terminate = false,
  isStale,
}: {
  base: { domain: string; workflowKey: string; instanceId: string; headers?: Record<string, string>; runtimeUrl?: string };
  effectiveState: StateResponse;
  signal?: AbortSignal;
  applyStatusGate: boolean;
  terminate?: boolean;
  isStale?: () => boolean;
}): Promise<void> {
  if (!shouldFetchView(effectiveState, { applyStatusGate, terminate })) return;

  const viewSource = resolveStateViewSource(effectiveState);
  const { setStateView, setStateViewLoading, setStateViewError } = useQuickRunStore.getState();
  setStateViewLoading(true);
  setStateViewError(false);

  try {
    const viewResponse = await QuickRunApi.getView({ ...base, transitionKey: viewSource?.transitionKey });

    if (signal?.aborted || isStale?.()) return;

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
    if (signal?.aborted || isStale?.()) return;
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
