import { useEffect, useState } from 'react';
import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import { HeadersConfigDialog } from '../quick-run/components/HeadersConfigDialog';
import { mergeQuickRunHeaders } from '../quick-run/pseudo-ui/mergeQuickRunHeaders';
import type { ViewResponse } from '../quick-run/types/quickrun.types';

import * as FunctionRunApi from './FunctionRunApi';
import { FunctionRunInputPane } from './components/FunctionRunInputPane';
import { FunctionRunResponsePane } from './components/FunctionRunResponsePane';
import { FunctionRunToolbar } from './components/FunctionRunToolbar';
import { computeInvokeGate, readInfoExchange } from './functionRunOrchestration';
import { buildInvokeRequest } from './functionRunPayload';
import { defaultVerbFor, resolveVerbs } from './functionRunVerbs';
import { toViewResponse } from './functionRunView';
import { useFunctionRunStore } from './store/functionRunStore';
import type { FunctionExchange } from './types/functionRun.types';

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
 * read `/info`, whether Invoke is enabled) is delegated to
 * `functionRunOrchestration`, which is the part of this feature that can
 * actually be unit-tested. `renderToStaticMarkup` never runs effects, so the
 * only thing this file's own test can verify is the very first render;
 * everything past that first render is covered by the orchestration suite.
 */
export function FunctionRunShell({
  domain,
  functionKey,
  scope,
  runtimeUrl,
  toolWideHeaders,
}: FunctionRunShellProps) {
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
  const response = useFunctionRunStore((s) => s.response);
  const responseDurationMs = useFunctionRunStore((s) => s.responseDurationMs);
  const set = useFunctionRunStore((s) => s.set);

  // The runner has no per-workflow bucket config, so the first
  // `mergeQuickRunHeaders` argument is always `null` — see the plan's note
  // that this is deliberate, not an omission.
  const [sessionHeaders, setSessionHeaders] = useState<Record<string, string>>({});
  const [savedHeaderEntries, setSavedHeaderEntries] = useState<{ name: string; value: string }[]>([]);
  const [headersOpen, setHeadersOpen] = useState(false);

  const headers = mergeQuickRunHeaders(null, sessionHeaders, undefined, toolWideHeaders);

  function applyInfoResponse(res: ApiResponse<FunctionExchange>) {
    if (!res.success) {
      set({
        infoLoading: false,
        info: null,
        infoExchange: null,
        infoError: 'Could not reach the runtime to load the function contract.',
      });
      return;
    }

    const { info: nextInfo, error } = readInfoExchange(res.data);
    set({ infoLoading: false, info: nextInfo, infoExchange: res.data, infoError: error });
    if (!nextInfo) return;

    set({ verb: defaultVerbFor(resolveVerbs(nextInfo.function.verbs)) });

    if (nextInfo.inputView?.hasView) {
      void FunctionRunApi.fetchContract({ path: nextInfo.inputView.href, headers, runtimeUrl }).then((viewRes) => {
        if (viewRes.success) set({ inputViewContent: toViewResponse(viewRes.data) });
      });
    }

    if (nextInfo.inputSchema?.hasSchema) {
      void FunctionRunApi.fetchContract({ path: nextInfo.inputSchema.href, headers, runtimeUrl }).then(
        (schemaRes) => {
          if (!schemaRes.success) return;
          const { data } = schemaRes;
          const isUsableSchema =
            data.status >= 200 &&
            data.status < 300 &&
            !data.jsonParseError &&
            typeof data.json === 'object' &&
            data.json !== null;
          if (isUsableSchema) set({ inputSchema: data.json as Record<string, unknown> });
        },
      );
    }
  }

  // Load /info on mount, and again whenever the function identity changes or
  // (for F/I scope) both scope ids become available.
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
    if (!idsReady) return undefined;

    let cancelled = false;
    const fire = () => {
      set({ infoLoading: true });
      void FunctionRunApi.getInfo({
        domain,
        functionKey,
        scope,
        workflowKey,
        instanceId,
        headers,
        runtimeUrl,
      }).then((res) => {
        if (!cancelled) applyInfoResponse(res);
      });
    };

    if (scope === 'D') {
      fire();
      return () => {
        cancelled = true;
      };
    }

    const timer = setTimeout(fire, IDS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // headers/runtimeUrl are read at fire-time via closure; they change rarely
    // (Headers dialog save, host config) compared to the per-keystroke fields
    // above, so they are deliberately excluded here to avoid re-deriving the
    // debounce timer's identity on every render.
  }, [domain, functionKey, scope, workflowKey, instanceId]);

  async function handleInvoke() {
    if (!info || !verb) return;

    const request = buildInvokeRequest({ verb, mode, viewFormData, payload, contentType });
    set({ invoking: true });
    const startedAt = Date.now();

    const res = await FunctionRunApi.invoke({
      path: info.function.href,
      verb,
      ...request,
      headers,
      runtimeUrl,
    });
    const responseDuration = Date.now() - startedAt;

    if (!res.success) {
      set({ invoking: false, responseDurationMs: responseDuration });
      return;
    }

    set({ invoking: false, response: res.data, responseDurationMs: responseDuration, outputViewContent: null });

    if (info.outputView?.hasView) {
      const outputRes = await FunctionRunApi.fetchContract({ path: info.outputView.href, headers, runtimeUrl });
      if (outputRes.success) set({ outputViewContent: toViewResponse(outputRes.data) });
    }
  }

  const verbs = info ? resolveVerbs(info.function.verbs) : [];
  const gate = computeInvokeGate({ info, scope, workflowKey, instanceId });

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
        onScopeIdsChange={(next) => set(next)}
      />

      {infoError ? (
        <p className="text-destructive-text text-xs" role="alert">
          {infoError}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FunctionRunInputPane
            mode={mode}
            onModeChange={(nextMode) => set({ mode: nextMode })}
            hasInputView={Boolean(info?.inputView?.hasView)}
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

          {response ? (
            <FunctionRunResponsePane
              response={response}
              durationMs={responseDurationMs}
              outputView={outputViewContent as ViewResponse | null}
            />
          ) : (
            <p className="text-muted-foreground text-xs">Pick a verb and choose Invoke to run this function.</p>
          )}
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
