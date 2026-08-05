import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { PanelSize } from 'react-resizable-panels';
import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import { useScriptPanelResizePanelRef } from '../code-editor/layout/ScriptEditorPanel.js';
import { HeadersConfigDialog } from '../quick-run/components/HeadersConfigDialog';
import { mergeQuickRunHeaders } from '../quick-run/pseudo-ui/mergeQuickRunHeaders';
import type { ViewResponse } from '../quick-run/types/quickrun.types';

import { areToolHeadersHostOwned } from '../../app/ToolHeadersSync.js';
import { Field } from '../../ui/Field.js';
import { Input } from '../../ui/Input.js';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/Resizable.js';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore.js';
import { useToolHeadersStore } from '../../store/useToolHeadersStore.js';

import * as FunctionRunApi from './FunctionRunApi';
import { FunctionRunEndpointBar } from './components/FunctionRunEndpointBar';
import { FunctionRunHeadersTab } from './components/FunctionRunHeadersTab';
import { FunctionRunInfoError } from './components/FunctionRunInfoError';
import { FunctionRunInputPane } from './components/FunctionRunInputPane';
import { FunctionRunParamsTab, type ParamsView } from './components/FunctionRunParamsTab';
import { FunctionRunRequestTabs } from './components/FunctionRunRequestTabs';
import { FunctionRunResponsePane } from './components/FunctionRunResponsePane';
import { buildEndpointPreview } from './functionRunEndpoint';
import { sanitizeHeaderRecord } from './functionRunHeaders';
import { computeInputViewAvailability, computeInvokeGate, loadFunctionInfo, runInvoke } from './functionRunOrchestration';
import { buildInvokeRequest, carriesBody, resolveEffectiveMode, resolveEffectiveRequestTab } from './functionRunPayload';
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
  /**
   * Which host this shell is mounted in.
   *
   * `'panel'` — the bottom slot of `FlowEditorCanvasAndScriptResizableColumn`
   * in the function editor: a short, width-generous panel, so the request
   * and response sit side by side. Also the only surface that gets a
   * maximize control, via `ScriptPanelResizeContext` — that context only
   * exists inside that host.
   *
   * `'standalone'` — the dedicated web page / extension webview: a
   * full-height, often narrower surface, so request and response stack
   * vertically (Postman classic).
   *
   * Explicit, not measured from width: it is testable and cannot flicker on
   * first paint. Defaults to `'panel'`, the original (only) host.
   */
  surface?: 'panel' | 'standalone';
}

const IDS_DEBOUNCE_MS = 400;

/** Stable across renders — `Group`'s `defaultLayout` only needs to be read once, on mount. */
const DEFAULT_LAYOUT = {
  'function-run-request': 50,
  'function-run-response': 50,
} as const;

/**
 * How far the maximize control grows the *outer* script-panel slot (the
 * whole `FunctionRunShell`, relative to the canvas above it in
 * `FlowEditorCanvasAndScriptResizableColumn`) — not this file's own inner
 * request/response split. Matches `ScriptEditorPanel`'s own `toggleMaximize`
 * exactly, since both consume the same `ScriptPanelResizeContext` panel and
 * should agree on what "maximized" means for that shared slot.
 */
const MAXIMIZED_OUTER_SIZE = '70%';

/**
 * What the endpoint bar's quiet "Headers" button should do, given whether
 * the Forge-wide set is host-owned (`areToolHeadersHostOwned`).
 *
 * `HeadersConfigDialog` only ever edits the Forge-wide set now (see the
 * shell's own `HeadersConfigDialog` usage) — when the host owns that value,
 * a save through the dialog would appear to work for the rest of the session
 * and then be silently overwritten the next time the panel opens (the exact
 * bug this whole reconciliation exists to fix). `'switch-to-headers-tab'`
 * routes to a surface that is genuinely usable either way: the Forge-wide
 * set is still visible there (read-only), and a per-run header — which
 * always saves, in both hosts — is one click away.
 */
export function resolveOpenHeadersAction(toolWideHeadersHostOwned: boolean): 'switch-to-headers-tab' | 'open-dialog' {
  return toolWideHeadersHostOwned ? 'switch-to-headers-tab' : 'open-dialog';
}

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
  surface = 'panel',
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
  const infoErrorIsAuthorization = useFunctionRunStore((s) => s.infoErrorIsAuthorization);
  const infoLoading = useFunctionRunStore((s) => s.infoLoading);
  const verb = useFunctionRunStore((s) => s.verb);
  const mode = useFunctionRunStore((s) => s.mode);
  const contentType = useFunctionRunStore((s) => s.contentType);
  const payload = useFunctionRunStore((s) => s.payload);
  const viewFormData = useFunctionRunStore((s) => s.viewFormData);
  const queryString = useFunctionRunStore((s) => s.queryString);
  const workflowKey = useFunctionRunStore((s) => s.workflowKey);
  const instanceId = useFunctionRunStore((s) => s.instanceId);
  const activeRequestTab = useFunctionRunStore((s) => s.activeRequestTab);
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
  //
  // `sessionHeaders` is deliberately *not* filtered as the Headers tab's
  // `KeyValueEditor` writes it on every keystroke — a blank-key row the user
  // just added (and has not typed a name into yet) has to survive being
  // written here, or it would vanish on the very next render before the user
  // could type into it. Filtering happens once, below, at the point these
  // headers are actually merged for a request — see `sanitizeHeaderRecord`.
  const [sessionHeaders, setSessionHeaders] = useState<Record<string, string>>({});
  const [headersOpen, setHeadersOpen] = useState(false);
  // Params tab's table/raw toggle — ephemeral UI state, not persisted in the
  // store (unlike `activeRequestTab`, which the plan calls out explicitly):
  // losing this preference on a tab switch or remount is a minor cosmetic
  // reset, not a loss of anything the user actually typed (`queryString`
  // itself lives in the store either way).
  const [paramsView, setParamsView] = useState<ParamsView>('table');

  const toolWideHeadersRecord = toolWideHeaders ?? {};
  // See `areToolHeadersHostOwned`'s own doc comment: true in the extension
  // (where the host injects this value and overwrites the persisted store
  // from it on every panel open, with no write-back path from here), false
  // in the web shell (where the persisted store IS the truth). Drives both
  // the Headers tab's Edit control and the two "Open Headers" shortcuts
  // below.
  const toolWideHeadersHostOwned = areToolHeadersHostOwned();

  // Maximize control (1d): only meaningful when this shell is hosted inside
  // `FlowEditorCanvasAndScriptResizableColumn` (`surface === 'panel'`) — that
  // is the only place `ScriptPanelResizeContext` is ever provided, so
  // `scriptLayoutPanelRef` is `null` for the standalone surface and the
  // control below simply does not render there. This toggles the *outer*
  // script-panel slot (this whole shell, relative to the canvas above it),
  // not the inner request/response split created further down.
  const scriptLayoutPanelRef = useScriptPanelResizePanelRef();
  const [isMaximized, setIsMaximized] = useState(false);
  const sizeBeforeMaximizeRef = useRef<PanelSize | null>(null);

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
  const toolWideHeadersKey = JSON.stringify(toolWideHeadersRecord);
  // Keyed on the stable serializations above, deliberately not on
  // `sessionHeaders`/`toolWideHeaders` themselves (a fresh object each
  // render would defeat the memo and reintroduce the per-render identity
  // change this exists to avoid). `react-hooks/exhaustive-deps` is not wired
  // up in this package's eslint config, so there is no lint rule to satisfy
  // here either way — this is a deliberate, documented deviation, not an
  // oversight.
  //
  // `sanitizeHeaderRecord` is what actually drops a still-blank-key row from
  // `sessionHeaders` — see its own doc comment for why that filtering must
  // not happen any earlier, in the Headers tab's own `onChange`.
  const headers = useMemo(
    () => mergeQuickRunHeaders(null, sanitizeHeaderRecord(sessionHeaders), undefined, toolWideHeadersRecord),
    [sessionHeadersKey, toolWideHeadersKey],
  );

  // Load /info on mount, and again whenever the function identity changes,
  // the headers change (see above), or — for F/I scope — both scope ids
  // become available.
  //
  // `workflowKey`/`instanceId` are freeform text fields the user edits one
  // keystroke at a time (below, in the request panel) — if this effect fired
  // its fetch unconditionally on every change to them, it would
  // issue one `/info` request per character typed once both fields already
  // have content. The debounce below collapses a burst of keystrokes into
  // the single request that actually matters: the one after the user stops
  // typing. A domain-scoped function has no such fields (they are never
  // rendered for scope `D`), so there is nothing to debounce there — it
  // fires immediately on mount / identity change.
  // Shared with the explicit Retry control below, so both agree on exactly
  // when a load may fire.
  const idsReady = scope === 'D' || (workflowKey.trim() !== '' && instanceId.trim() !== '');

  useEffect(() => {
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

  /**
   * Re-runs `/info` immediately, bypassing the debounce above entirely — the
   * fix for a 403 that never got surfaced as recoverable: the user opens
   * Headers, saves a token, and needs to retry right away rather than wait
   * out (or accidentally re-trigger) the keystroke debounce, which does not
   * even apply to a header change in the first place.
   */
  async function handleRetryInfo() {
    if (!idsReady) return;
    await loadFunctionInfo({
      domain,
      functionKey,
      scope,
      workflowKey,
      instanceId,
      headers,
      runtimeUrl,
      isCancelled: () => false,
      set,
      api: FunctionRunApi,
    });
  }

  async function handleInvoke() {
    if (!info || !verb) return;
    await runInvoke({
      info,
      verb,
      mode: effectiveMode,
      viewFormData,
      payload,
      contentType,
      queryString,
      headers,
      runtimeUrl,
      buildInvokeRequest,
      set,
      api: FunctionRunApi,
    });
  }

  /**
   * The endpoint bar's quiet "Headers" button handler, split from its
   * decision (`resolveOpenHeadersAction`, just below) purely so the decision
   * itself is directly unit-testable — this file's own test can only ever
   * see the very first render, never a click.
   *
   * `FunctionRunInfoError`'s own "Open Headers" shortcut (the 403 recovery
   * path) is *not* routed through this — that component is a section-3 file
   * this task does not otherwise touch, and unlike here, switching tabs
   * would have no visible effect there: `FunctionRunInfoError` renders
   * *instead of* the request tabs while `infoError` is set, not alongside
   * them, so there is no tab to switch into. It still opens the same dialog
   * unconditionally for now — see the report on this task for the follow-up
   * this leaves.
   */
  function handleOpenHeaders() {
    if (resolveOpenHeadersAction(toolWideHeadersHostOwned) === 'switch-to-headers-tab') {
      set({ activeRequestTab: 'headers' });
    } else {
      setHeadersOpen(true);
    }
  }

  /**
   * Mirrors `ScriptEditorPanel`'s own `toggleMaximize` one-for-one — both
   * consume the same `ScriptPanelResizeContext` panel (the outer
   * script-panel slot), so growing/restoring it has to agree on what
   * "maximized" means and what to fall back to when there is no captured
   * previous size. A no-op if `scriptLayoutPanelRef` has no live handle
   * (never true when `surface === 'panel'`, since that is the only host that
   * renders the maximize control at all — see the JSX below).
   */
  function toggleMaximize() {
    const api = scriptLayoutPanelRef?.current;
    if (!api) return;
    if (!isMaximized) {
      sizeBeforeMaximizeRef.current = api.getSize();
      api.resize(MAXIMIZED_OUTER_SIZE);
      setIsMaximized(true);
    } else {
      const prev = sizeBeforeMaximizeRef.current;
      if (prev) {
        api.resize(`${prev.asPercentage}%`);
      } else {
        api.resize(useEditorPanelsStore.getState().scriptPanelHeight);
      }
      setIsMaximized(false);
    }
  }

  // `resolveVerbs(undefined)` returns all four verbs (no restriction known
  // yet), so the select always has options — even before `/info` resolves —
  // rather than rendering empty.
  const verbs = resolveVerbs(info?.function.verbs);
  const gate = computeInvokeGate({ info, infoError, scope, workflowKey, instanceId });

  // GET is the same fallback `defaultVerbFor` prefers, used here only for
  // the brief window before `/info` has set a real verb — see Fix 2: a
  // body-less verb hides the payload editor outright rather than relabeling
  // it, so this decision has to exist even before the contract is loaded.
  const effectiveVerb = verb ?? 'GET';
  const payloadAvailable = carriesBody(effectiveVerb);
  const effectiveMode = resolveEffectiveMode(mode, effectiveVerb);
  // Same computed-override idiom as `effectiveMode` just above, applied to
  // which request tab is shown: a stored `'body'` tab is hidden (falls back
  // to Params) without being overwritten, so switching back to a
  // body-bearing verb restores it with no special-case wiring — see
  // `resolveEffectiveRequestTab`'s own doc comment.
  const effectiveRequestTab = resolveEffectiveRequestTab(activeRequestTab, effectiveVerb);

  // I4: driven by whether the *adapted* view actually came back, not by
  // `/info`'s bare `hasView` flag — see `computeInputViewAvailability`.
  const { hasUsableInputView, declaredButUnavailable } = computeInputViewAvailability({ info, inputViewContent });

  // The path the request will actually hit — see `buildEndpointPreview`'s own
  // doc comment for why this has to reimplement `normalizeRuntimeHref`
  // locally rather than importing it (designer-ui may not depend on
  // services-core).
  const endpoint = buildEndpointPreview({ info, scope, domain, functionKey, workflowKey, instanceId, queryString });

  // Only ever true for `surface === 'panel'`: `scriptLayoutPanelRef` comes
  // from `ScriptPanelResizeContext`, which only `FlowEditorCanvasAndScript-
  // ResizableColumn` provides — the standalone web page / extension webview
  // never wraps this shell in that context, so the ref is always `null`
  // there and the control renders as if `surface` had no maximize concept at
  // all (correctly — there is nothing outside this shell to grow into).
  const showMaximizeControl = surface === 'panel' && scriptLayoutPanelRef != null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border-subtle flex items-start gap-1 border-b p-2">
        <div className="min-w-0 flex-1">
          <FunctionRunEndpointBar
            verbs={verbs}
            verb={verb}
            onVerbChange={(nextVerb) => set({ verb: nextVerb })}
            endpoint={endpoint}
            canInvoke={gate.canInvoke}
            invokeDisabledReason={gate.reason}
            invoking={invoking}
            onInvoke={() => void handleInvoke()}
            onOpenHeaders={handleOpenHeaders}
          />
        </div>

        {showMaximizeControl ? (
          <button
            type="button"
            onClick={toggleMaximize}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-lg p-1.5 transition-all"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        ) : null}
      </div>

      {infoError ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <FunctionRunInfoError
            message={infoError}
            isAuthorizationError={infoErrorIsAuthorization}
            loading={infoLoading}
            canRetry={idsReady}
            onRetry={() => void handleRetryInfo()}
            onOpenHeaders={() => setHeadersOpen(true)}
          />
        </div>
      ) : (
        <ResizablePanelGroup
          id="function-run-shell"
          orientation={surface === 'standalone' ? 'vertical' : 'horizontal'}
          defaultLayout={DEFAULT_LAYOUT}
          className="min-h-0 flex-1">
          <ResizablePanel
            id="function-run-request"
            minSize="20%"
            className="flex min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-2">
                {/*
                 * Scope-id fields (F/I only) live here, above the tab strip
                 * — not inside a tab, and not folded into
                 * `FunctionRunEndpointBar` (a section-1 file this task
                 * leaves untouched). They are request *identity*: which
                 * workflow instance the request targets, not a facet of the
                 * request body/params/headers a user would expect to have
                 * to switch tabs to find, and they drive the `/info` load
                 * regardless of which of Params/Headers/Body is active. The
                 * endpoint bar was the other option the plan offered, but
                 * putting a scope-only concern there would mean every
                 * domain-scoped (D) function pays for an empty second row,
                 * and would touch a component this task does not otherwise
                 * need to change.
                 */}
                {scope !== 'D' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Workflow key" className="min-w-40 flex-1">
                      <Input
                        size="sm"
                        value={workflowKey}
                        onChange={(e) =>
                          // I5: the ids just changed, so whatever `info` was
                          // loaded for the *previous* ids no longer applies.
                          // Clear it immediately (rather than waiting out the
                          // debounce + request) so Send is not enabled —
                          // against the wrong instance — for that whole
                          // window.
                          set({
                            workflowKey: e.target.value,
                            info: null,
                            infoError: null,
                            infoErrorIsAuthorization: false,
                          })
                        }
                      />
                    </Field>
                    <Field label="Instance id" className="min-w-40 flex-1">
                      <Input
                        size="sm"
                        value={instanceId}
                        onChange={(e) =>
                          set({
                            instanceId: e.target.value,
                            info: null,
                            infoError: null,
                            infoErrorIsAuthorization: false,
                          })
                        }
                      />
                    </Field>
                    <span className="text-muted-foreground w-full text-[10px]">
                      A {scope}-scoped function runs against a workflow instance.
                    </span>
                  </div>
                ) : null}

                {declaredButUnavailable ? (
                  <p className="text-muted-foreground text-[10px]">
                    This function declares an input view, but it could not be loaded
                    {payloadAvailable ? ' — use Payload instead.' : ' — use the query string field instead.'}
                  </p>
                ) : null}

                <FunctionRunRequestTabs
                  activeTab={effectiveRequestTab}
                  onTabChange={(tab) => set({ activeRequestTab: tab })}
                  bodyAvailable={payloadAvailable}
                  paramsContent={
                    <FunctionRunParamsTab
                      queryString={queryString}
                      onQueryStringChange={(next) => set({ queryString: next })}
                      view={paramsView}
                      onViewChange={setParamsView}
                    />
                  }
                  headersContent={
                    <FunctionRunHeadersTab
                      toolWideHeaders={toolWideHeadersRecord}
                      toolWideHeadersHostOwned={toolWideHeadersHostOwned}
                      sessionHeaders={sessionHeaders}
                      onSessionHeadersChange={setSessionHeaders}
                      onEditToolWideHeaders={() => setHeadersOpen(true)}
                    />
                  }
                  bodyContent={
                    <FunctionRunInputPane
                      mode={mode}
                      onModeChange={(nextMode) => set({ mode: nextMode })}
                      hasInputView={hasUsableInputView}
                      payloadAvailable={payloadAvailable}
                      inputView={inputViewContent as ViewResponse | null}
                      onViewFormChange={(data) => set({ viewFormData: data })}
                      payloadEditorProps={{
                        contentType,
                        onContentTypeChange: (nextContentType) => set({ contentType: nextContentType }),
                        value: payload,
                        onChange: (nextPayload) => set({ payload: nextPayload }),
                        schema: inputSchema,
                      }}
                    />
                  }
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            id="function-run-response"
            minSize="20%"
            className="flex min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                  <p className="text-muted-foreground text-xs">Pick a verb and choose Send to run this function.</p>
                ) : null}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/*
       * Scoped to the Forge-wide set now, not this run's own headers — those
       * are edited inline in the Headers tab's `KeyValueEditor` instead (see
       * `FunctionRunHeadersTab`). This dialog is the one place in the app
       * that already commits to `useToolHeadersStore`, so both the endpoint
       * bar's quiet "Headers" button and the Headers tab's "Edit" control
       * route here rather than each getting their own editor for the same
       * shared data.
       */}
      <HeadersConfigDialog
        open={headersOpen}
        onClose={() => setHeadersOpen(false)}
        initialHeaders={Object.entries(toolWideHeadersRecord).map(([name, value]) => ({ name, value }))}
        onSave={(nextHeaders) =>
          useToolHeadersStore.getState().setHeaders(Object.fromEntries(nextHeaders.map((h) => [h.name, h.value])))
        }
      />
    </div>
  );
}
