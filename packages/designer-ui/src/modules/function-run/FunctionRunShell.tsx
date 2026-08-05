import { useEffect, useMemo, useState } from 'react';
import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import { HeadersConfigDialog } from '../quick-run/components/HeadersConfigDialog';
import { mergeQuickRunHeaders } from '../quick-run/pseudo-ui/mergeQuickRunHeaders';
import type { ViewResponse } from '../quick-run/types/quickrun.types';

import * as FunctionRunApi from './FunctionRunApi';
import { FunctionRunInputPane } from './components/FunctionRunInputPane';
import { FunctionRunResponsePane } from './components/FunctionRunResponsePane';
import { FunctionRunToolbar } from './components/FunctionRunToolbar';
import { computeInputViewAvailability, computeInvokeGate, loadFunctionInfo, runInvoke } from './functionRunOrchestration';
import { buildInvokeRequest } from './functionRunPayload';
import { resolveVerbs } from './functionRunVerbs';
import { useFunctionRunStore } from './store/functionRunStore';

export interface FunctionRunShellProps {
  domain: string;
  functionKey: string;
  scope: FunctionScope;
  runtimeUrl?: string;
  projectId?: string;
  /** Forge-wide headers. Task 19 supplies these from the host. */
  toolWideHeaders?: Record<string, string>;
}

const IDS_DEBOUNCE_MS = 400;

/**
 * Wires the pure function-run modules and the presentational components
 * built in earlier tasks into a working surface.
 *
 * This component is intentionally thin — every decision it makes (how to
 * read `/info`, whether Invoke is enabled, the actual `/info` → contract →
 * invoke sequencing) is delegated to `functionRunOrchestration`, which is
 * the part of this feature that can actually be unit-tested. This file's own
 * test can only ever see the very first render (`renderToStaticMarkup` never
 * runs effects); everything past that is covered by the orchestration suite.
 */
export function FunctionRunShell({
  domain,
  functionKey,
  scope,
  runtimeUrl,
  toolWideHeaders,
}: FunctionRunShellProps) {
  // The store is a deliberate module-level singleton (see its own comment),
  // which means it survives a genuine unmount/remount for a *different*
  // function unless something clears it first. A `useEffect` keyed on
  // identity would be the natural place for this, except effects never run
  // under this package's SSR-only test harness — a wiring bug here
  // (forgetting the call, or a typo in the deps) would be invisible to every
  // test in this file. A `useState` lazy initializer instead runs
  // synchronously as part of this component's very first render — the same
  // moment `renderToStaticMarkup` *does* exercise — so a fresh mount for a
  // new function key clears out the previous function's `info`, `response`,
  // `payload`, `mode`, scope ids, etc. before anything below reads them.
  // `resetIfNewIdentity` (not a bare `reset()`) only clears when the identity
  // actually differs from what is already loaded — a re-render for the
  // *same* function must not wipe state it just finished loading.
  //
  // A test can only observe the effect of this call via
  // `useFunctionRunStore.getState()` directly, never via the rendered HTML:
  // zustand's React binding feeds `useSyncExternalStore`'s SSR snapshot
  // argument `selector(api.getInitialState())` — the state as it was at
  // *store creation*, frozen forever — so every `useFunctionRunStore(...)`
  // selector read in this component (and therefore everything this render
  // produces) reflects only that frozen snapshot under
  // `renderToStaticMarkup`, never anything a test seeds via `.set()`
  // beforehand. That is a hard limitation of this package's SSR-only test
  // harness, not something fixable from this file — see
  // `FunctionRunShell.vitest.test.tsx`'s mount-reset test, which asserts
  // through `getState()` for exactly this reason, and
  // `functionRunOrchestration.ts`'s `computeInputViewAvailability` /
  // `loadFunctionInfo` / `runInvoke`, which exist as plain functions
  // specifically so their logic can be tested without going through a
  // zustand-backed render at all.
  useState(() => {
    useFunctionRunStore.getState().resetIfNewIdentity(`${domain}::${functionKey}`);
    return null;
  });

  const info = useFunctionRunStore((s) => s.info);
  const infoError = useFunctionRunStore((s) => s.infoError);
  const verb = useFunctionRunStore((s) => s.verb);
  const mode = useFunctionRunStore((s) => s.mode);
  const contentType = useFunctionRunStore((s) => s.contentType);
  const payload = useFunctionRunStore((s) => s.payload);
  const viewFormData = useFunctionRunStore((s) => s.viewFormData);
  const workflowKey = useFunctionRunStore((s) => s.workflowKey);
  const instanceId = useFunctionRunStore((s) => s.instanceId);
  const inputViewContent = useFunctionRunStore((s) => s.inputViewContent);
  const inputSchema = useFunctionRunStore((s) => s.inputSchema);
  const outputViewContent = useFunctionRunStore((s) => s.outputViewContent);
  const invoking = useFunctionRunStore((s) => s.invoking);
  const invokeError = useFunctionRunStore((s) => s.invokeError);
  const response = useFunctionRunStore((s) => s.response);
  const responseDurationMs = useFunctionRunStore((s) => s.responseDurationMs);
  const set = useFunctionRunStore((s) => s.set);

  // The runner has no per-workflow bucket config, so the first
  // `mergeQuickRunHeaders` argument is always `null` — see the plan's note
  // that this is deliberate, not an omission.
  const [sessionHeaders, setSessionHeaders] = useState<Record<string, string>>({});
  const [savedHeaderEntries, setSavedHeaderEntries] = useState<{ name: string; value: string }[]>([]);
  const [headersOpen, setHeadersOpen] = useState(false);

  // Keyed on a stable *serialization* of the header maps, not the maps
  // themselves — `mergeQuickRunHeaders` returns a fresh object every render,
  // and a bare `useMemo(..., [sessionHeaders, toolWideHeaders])` would still
  // recompute on every render for that same reason if those maps were ever
  // reconstructed upstream. A stable value here is what lets `headers` sit
  // in the /info effect's dependency array below without refiring it on
  // every unrelated render — which is also the fix for a 403: without a
  // stable `headers`, adding it to the deps at all was not safe, so the
  // effect could never see a header the user pastes into Headers after
  // hitting a permissions wall, leaving that error permanently unrecoverable
  // short of changing the function itself.
  const sessionHeadersKey = JSON.stringify(sessionHeaders);
  const toolWideHeadersKey = JSON.stringify(toolWideHeaders ?? {});
  // Keyed on the stable serializations above, deliberately not on
  // `sessionHeaders`/`toolWideHeaders` themselves (a fresh object each
  // render would defeat the memo and reintroduce the per-render identity
  // change this exists to avoid). `react-hooks/exhaustive-deps` is not wired
  // up in this package's eslint config, so there is no lint rule to satisfy
  // here either way — this is a deliberate, documented deviation, not an
  // oversight.
  const headers = useMemo(
    () => mergeQuickRunHeaders(null, sessionHeaders, undefined, toolWideHeaders),
    [sessionHeadersKey, toolWideHeadersKey],
  );

  // Load /info on mount, and again whenever the function identity changes,
  // the headers change (see above), or — for F/I scope — both scope ids
  // become available.
  //
  // `workflowKey`/`instanceId` are freeform text fields the user edits one
  // keystroke at a time through `FunctionRunToolbar`'s `onChange` — if this
  // effect fired its fetch unconditionally on every change to them, it would
  // issue one `/info` request per character typed once both fields already
  // have content. The debounce below collapses a burst of keystrokes into
  // the single request that actually matters: the one after the user stops
  // typing. A domain-scoped function has no such fields (they are never
  // rendered for scope `D`), so there is nothing to debounce there — it
  // fires immediately on mount / identity change.
  useEffect(() => {
    const idsReady = scope === 'D' || (workflowKey.trim() !== '' && instanceId.trim() !== '');
    if (!idsReady) {
      // Ids are no longer both present (the user just cleared one) — there
      // is nothing to load, and any request that *was* in flight a moment
      // ago is about to be marked cancelled below. Don't leave `infoLoading`
      // stuck true with nothing left that will ever flip it back.
      set({ infoLoading: false });
      return undefined;
    }

    let cancelled = false;
    const runLoad = () => {
      void loadFunctionInfo({
        domain,
        functionKey,
        scope,
        workflowKey,
        instanceId,
        headers,
        runtimeUrl,
        isCancelled: () => cancelled,
        set,
        api: FunctionRunApi,
      });
    };

    const timer = scope === 'D' ? null : setTimeout(runLoad, IDS_DEBOUNCE_MS);
    if (scope === 'D') runLoad();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      set({ infoLoading: false });
    };
  }, [domain, functionKey, scope, workflowKey, instanceId, headers, runtimeUrl, set]);

  async function handleInvoke() {
    if (!info || !verb) return;
    await runInvoke({
      info,
      verb,
      mode,
      viewFormData,
      payload,
      contentType,
      headers,
      runtimeUrl,
      buildInvokeRequest,
      set,
      api: FunctionRunApi,
    });
  }

  // `resolveVerbs(undefined)` returns all four verbs (no restriction known
  // yet), so the select always has options — even before `/info` resolves —
  // rather than rendering empty.
  const verbs = resolveVerbs(info?.function.verbs);
  const gate = computeInvokeGate({ info, infoError, scope, workflowKey, instanceId });

  // I4: driven by whether the *adapted* view actually came back, not by
  // `/info`'s bare `hasView` flag — see `computeInputViewAvailability`.
  const { hasUsableInputView, declaredButUnavailable } = computeInputViewAvailability({ info, inputViewContent });

  return (
    <div className="space-y-4 p-4">
      <FunctionRunToolbar
        verbs={verbs}
        verb={verb}
        onVerbChange={(nextVerb) => set({ verb: nextVerb })}
        canInvoke={gate.canInvoke}
        invokeDisabledReason={gate.reason}
        invoking={invoking}
        onInvoke={() => void handleInvoke()}
        onOpenHeaders={() => setHeadersOpen(true)}
        scope={scope}
        workflowKey={workflowKey}
        instanceId={instanceId}
        onScopeIdsChange={(next) =>
          // I5: the ids just changed, so whatever `info` was loaded for the
          // *previous* ids no longer applies. Clear it immediately (rather
          // than waiting out the debounce + request) so Invoke is not
          // enabled — against the wrong instance — for that whole window.
          set({ ...next, info: null, infoError: null })
        }
      />

      {infoError ? (
        <p className="text-destructive-text text-xs" role="alert">
          {infoError}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            {declaredButUnavailable ? (
              <p className="text-muted-foreground text-[10px]">
                This function declares an input view, but it could not be loaded — use Payload instead.
              </p>
            ) : null}
            <FunctionRunInputPane
              mode={mode}
              onModeChange={(nextMode) => set({ mode: nextMode })}
              hasInputView={hasUsableInputView}
              inputView={inputViewContent as ViewResponse | null}
              onViewFormChange={(data) => set({ viewFormData: data })}
              payloadEditorProps={{
                contentType,
                onContentTypeChange: (nextContentType) => set({ contentType: nextContentType }),
                value: payload,
                onChange: (nextPayload) => set({ payload: nextPayload }),
                schema: inputSchema,
                verb: verb ?? 'GET',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            {invokeError ? (
              <p className="text-destructive-text text-xs" role="alert">
                {invokeError}
              </p>
            ) : null}
            {response ? (
              <FunctionRunResponsePane
                response={response}
                durationMs={responseDurationMs}
                outputView={outputViewContent as ViewResponse | null}
              />
            ) : !invokeError ? (
              <p className="text-muted-foreground text-xs">Pick a verb and choose Invoke to run this function.</p>
            ) : null}
          </div>
        </div>
      )}

      <HeadersConfigDialog
        open={headersOpen}
        onClose={() => setHeadersOpen(false)}
        initialHeaders={savedHeaderEntries}
        onSave={(nextHeaders) => {
          setSavedHeaderEntries(nextHeaders);
          setSessionHeaders(Object.fromEntries(nextHeaders.map((h) => [h.name, h.value])));
        }}
      />
    </div>
  );
}
