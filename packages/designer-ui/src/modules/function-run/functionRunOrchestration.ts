import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import type { FunctionScope, FunctionVerb } from '@vnext-forge-studio/vnext-types';

import type { ContentTypeId, InvokeRequest, InvokeRequestInput, RunMode } from './functionRunPayload';
import { isAuthorizationFailure } from './functionRunStatus';
import { defaultVerbFor, resolveVerbs } from './functionRunVerbs';
import { toViewResponse } from './functionRunView';
import type { FunctionExchange, FunctionInfo } from './types/functionRun.types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A payload counts as usable info only when it is an object carrying `function.href`. */
function isUsableInfo(json: unknown): json is FunctionInfo {
  if (!isPlainObject(json)) return false;
  const fn = json.function;
  return isPlainObject(fn) && typeof fn.href === 'string' && fn.href.length > 0;
}

export interface InfoReadResult {
  info: FunctionInfo | null;
  /** User-facing explanation when `info` is null. */
  error: string | null;
  /**
   * True exactly when `error` reflects a 401/403 on `/info`.
   *
   * Lets a caller decide whether to point the user at Headers + Retry
   * (a 403 is recoverable — configure auth and try again) without
   * re-deriving which statuses count as an authorization failure by
   * string-matching `error`'s text.
   */
  isAuthorizationError: boolean;
}

/**
 * Maps an `/info` exchange onto what the runner shows.
 *
 * Each non-2xx gets its own sentence because they mean genuinely different
 * things and send the user to different places: a 403 is a permissions
 * problem (discovery and execution share one access policy), a 404 means the
 * key has no `sys-functions` component at all — which is the expected answer
 * for a built-in system function like `state` or `view`.
 */
export function readInfoExchange(exchange: FunctionExchange): InfoReadResult {
  const { status } = exchange;

  if (status === 404) {
    return {
      info: null,
      error:
        'This function key has no sys-functions component (expected for a built-in system function such as state, view, or data).',
      isAuthorizationError: false,
    };
  }

  if (isAuthorizationFailure(status)) {
    return {
      info: null,
      error:
        "You are not allowed to view this function's contract. Configure request headers (Headers) with the right credentials, then Retry.",
      isAuthorizationError: true,
    };
  }

  if (status < 200 || status >= 300) {
    return { info: null, error: `The function info request failed with status ${status}.`, isAuthorizationError: false };
  }

  const json = 'json' in exchange ? exchange.json : undefined;
  if (!isUsableInfo(json)) {
    return { info: null, error: 'The function info response could not be read.', isAuthorizationError: false };
  }

  return { info: json, error: null, isAuthorizationError: false };
}

export interface InvokeGate {
  canInvoke: boolean;
  /** Non-null exactly when `canInvoke` is false. Shown next to the button. */
  reason: string | null;
}

/**
 * Whether Invoke is enabled, and if not, which specific thing is missing.
 *
 * Names the field rather than saying "incomplete" — a disabled control with
 * no explanation is the failure mode this whole surface is designed against.
 */
export function computeInvokeGate(input: {
  info: FunctionInfo | null;
  /** From the store — a non-null value here means `/info` permanently failed. */
  infoError: string | null;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
}): InvokeGate {
  const { info, infoError, scope, workflowKey, instanceId } = input;

  if (!info) {
    // "Waiting" is only true while a request could still land — once /info
    // has permanently failed (404/403/500/unreadable body), the contract
    // will never arrive on its own, so the button's reason must say that
    // instead of implying a load is still in progress next to the error
    // message already shown for `infoError`.
    if (infoError) {
      return { canInvoke: false, reason: 'The function contract could not be loaded.' };
    }
    return { canInvoke: false, reason: 'Waiting for the function contract to load.' };
  }

  if (scope !== 'D') {
    if (workflowKey.trim() === '') {
      return { canInvoke: false, reason: 'Enter a workflow key to run this function.' };
    }
    if (instanceId.trim() === '') {
      return { canInvoke: false, reason: 'Enter an instance id to run this function.' };
    }
  }

  return { canInvoke: true, reason: null };
}

export interface InputViewAvailability {
  /** What `FunctionRunInputPane`'s `hasInputView` should receive. */
  hasUsableInputView: boolean;
  /**
   * True when `/info` declared an input view but the adapted content never
   * arrived (the fetch 404s, or the body didn't parse into something
   * usable). Lets the shell say *why* View is unavailable instead of
   * rendering the same "this function declares no input view" hint for a
   * genuinely different situation.
   */
  declaredButUnavailable: boolean;
}

/**
 * Whether the input-view toggle has something to actually show.
 *
 * Deliberately keyed off the *adapted* `inputViewContent`, not `/info`'s bare
 * `inputView.hasView` flag: a function can declare an input view and still
 * have nothing to show for it (the view fetch 404s, or returns a body
 * `toViewResponse` can't parse into a `ViewResponse`), and `hasView` alone
 * doesn't know that. Offering a "View" mode gated only on the flag would let
 * the user select it and see a blank pane with no explanation.
 */
export function computeInputViewAvailability(input: {
  info: Pick<FunctionInfo, 'inputView'> | null;
  inputViewContent: unknown;
}): InputViewAvailability {
  const declaredInputView = Boolean(input.info?.inputView?.hasView);
  const hasUsableInputView = Boolean(input.inputViewContent);
  return { hasUsableInputView, declaredButUnavailable: declaredInputView && !hasUsableInputView };
}

// ---------------------------------------------------------------------------
// Async sequencing
//
// Everything below drives the actual `/info` → contract-fetch → invoke
// network sequencing. It is expressed as plain, dependency-injected async
// functions — not methods on the component — specifically so it can be unit
// tested directly: this package has no jsdom, and `renderToStaticMarkup`
// never runs effects, so a real interleaving bug (two overlapping fetches
// racing to write the store) cannot be reproduced by rendering the shell at
// all. Injecting `api`/`set`/`isCancelled` as parameters instead of closing
// over component state lets a test control exactly when each promise
// resolves and observe exactly what the store would have received.
// ---------------------------------------------------------------------------

/**
 * The two `FunctionRunApi` calls this module needs, shaped structurally so
 * this file never has to import `FunctionRunApi.ts` (and its `callApi`
 * transport dependency) just for a type.
 */
export interface RunInfoApi {
  getInfo: (params: {
    domain: string;
    functionKey: string;
    scope: FunctionScope;
    workflowKey?: string;
    instanceId?: string;
    headers?: Record<string, string>;
    runtimeUrl?: string;
  }) => Promise<ApiResponse<FunctionExchange>>;
  fetchContract: (params: {
    path: string;
    /** Anchor for stripping the href's gateway prefix — see `rebaseRuntimeHref`. */
    domain: string;
    headers?: Record<string, string>;
    runtimeUrl?: string;
  }) => Promise<ApiResponse<FunctionExchange>>;
}

export interface RunInvokeApi {
  invoke: (params: {
    path: string;
    domain: string;
    verb: FunctionVerb;
    body?: string;
    contentType?: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    runtimeUrl?: string;
  }) => Promise<ApiResponse<FunctionExchange>>;
  fetchContract: RunInfoApi['fetchContract'];
}

/** The store fields `loadFunctionInfo` and `runInvoke` ever write. */
export type FunctionRunSetter = (
  patch: Partial<{
    infoLoading: boolean;
    info: FunctionInfo | null;
    infoExchange: FunctionExchange | null;
    infoError: string | null;
    infoErrorIsAuthorization: boolean;
    verb: FunctionVerb | null;
    inputViewContent: unknown;
    inputViewLoading: boolean;
    inputSchema: Record<string, unknown> | null;
    invoking: boolean;
    invokeError: string | null;
    response: FunctionExchange | null;
    responseDurationMs: number | null;
    outputViewContent: unknown;
  }>,
) => void;

const TRANSPORT_INFO_FALLBACK = 'Could not reach the runtime to load the function contract.';
const TRANSPORT_INVOKE_FALLBACK = 'Could not reach the runtime to invoke this function.';

function isUsableSchemaExchange(data: FunctionExchange): data is FunctionExchange & { json: Record<string, unknown> } {
  return (
    data.status >= 200 &&
    data.status < 300 &&
    !data.jsonParseError &&
    typeof data.json === 'object' &&
    data.json !== null &&
    !Array.isArray(data.json)
  );
}

export interface LoadFunctionInfoParams {
  domain: string;
  functionKey: string;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
  headers: Record<string, string>;
  runtimeUrl: string | undefined;
  /**
   * Checked after every `await` before writing to the store. Must reflect
   * *this specific call's* cancellation — not a shared/reused flag — so a
   * stale call started before a newer one cannot silently overwrite what the
   * newer call already wrote, no matter which one's network round trip
   * happens to finish first.
   */
  isCancelled: () => boolean;
  set: FunctionRunSetter;
  api: RunInfoApi;
}

/**
 * Loads `/info`, then — only for the calls this cancellation check still
 * allows — the input view and input schema it declares.
 *
 * Every write is individually guarded by `isCancelled()`, not just the
 * initial `/info` response: the input-view and input-schema fetches each
 * have their own `await`, so a call that was cancelled *after* `/info`
 * resolved but *before* one of those slower follow-ups did must still not
 * write anything. Guarding only the entry point (and trusting nothing after
 * it can race) is exactly the bug this function exists to not repeat.
 */
export async function loadFunctionInfo(params: LoadFunctionInfoParams): Promise<void> {
  const { domain, functionKey, scope, workflowKey, instanceId, headers, runtimeUrl, isCancelled, set, api } = params;

  set({ infoLoading: true });
  const res = await api.getInfo({ domain, functionKey, scope, workflowKey, instanceId, headers, runtimeUrl });
  if (isCancelled()) return;

  if (!res.success) {
    set({
      infoLoading: false,
      info: null,
      infoExchange: null,
      infoError: res.error.message || TRANSPORT_INFO_FALLBACK,
      // A transport failure never went through `readInfoExchange` — it is a
      // reachability problem, not an authorization one, whatever headers are
      // configured.
      infoErrorIsAuthorization: false,
    });
    return;
  }

  const { info, error, isAuthorizationError } = readInfoExchange(res.data);
  set({ infoLoading: false, info, infoExchange: res.data, infoError: error, infoErrorIsAuthorization: isAuthorizationError });
  if (!info) return;

  set({ verb: defaultVerbFor(resolveVerbs(info.function.verbs)) });

  if (info.inputView?.hasView) {
    // The view section is visible from the moment `/info` declares a view, so
    // this step owns its own loading flag: `infoLoading` is already false by
    // now, and without this the section would render its "could not be
    // loaded" error for the whole duration of a healthy fetch.
    set({ inputViewLoading: true });
    const viewRes = await api.fetchContract({
      path: info.inputView.href,
      // `info.domain` rather than the caller's `domain` prop: the engine that
      // emitted this href is the authority on which domain segment anchors it.
      domain: info.domain,
      headers,
      runtimeUrl,
    });
    if (!isCancelled()) {
      // Cleared on failure too — a fetch that came back is no longer loading,
      // whatever it came back with. Leaving the flag set would strand the
      // section on a spinner instead of stating the failure.
      set({
        inputViewLoading: false,
        ...(viewRes.success ? { inputViewContent: toViewResponse(viewRes.data) } : {}),
      });
    }
  }

  if (info.inputSchema?.hasSchema) {
    const schemaRes = await api.fetchContract({
      path: info.inputSchema.href,
      domain: info.domain,
      headers,
      runtimeUrl,
    });
    if (!isCancelled() && schemaRes.success && isUsableSchemaExchange(schemaRes.data)) {
      set({ inputSchema: schemaRes.data.json });
    }
  }
}

export interface RunInvokeParams {
  info: FunctionInfo;
  verb: FunctionVerb;
  mode: RunMode;
  viewFormData: Record<string, unknown> | undefined;
  payload: Record<string, unknown> | undefined;
  contentType: ContentTypeId;
  /** Free-text query-string input; see `functionRunPayload.ts`'s `parseQueryString`. */
  queryString: string;
  headers: Record<string, string>;
  runtimeUrl: string | undefined;
  buildInvokeRequest: (input: InvokeRequestInput) => InvokeRequest;
  set: FunctionRunSetter;
  api: RunInvokeApi;
}

/**
 * Runs one invoke and, on success, follows the declared output view.
 *
 * A transport failure (network error, host rejected the call — `res.success
 * === false`) is not the same outcome as a non-2xx `response`: the function
 * itself never got to answer. It must never look like a successful new
 * invoke wearing an updated duration next to whatever the *previous* run's
 * `response` happened to be — see `invokeError`, which this sets and the
 * shell renders, and which every earlier invoke's success clears.
 */
export async function runInvoke(params: RunInvokeParams): Promise<void> {
  const {
    info,
    verb,
    mode,
    viewFormData,
    payload,
    contentType,
    queryString,
    headers,
    runtimeUrl,
    buildInvokeRequest,
    set,
    api,
  } = params;

  const request = buildInvokeRequest({ verb, mode, viewFormData, payload, contentType, queryString });
  set({ invoking: true, invokeError: null });
  const startedAt = Date.now();

  const res = await api.invoke({
    path: info.function.href,
    domain: info.domain,
    verb,
    ...request,
    headers,
    runtimeUrl,
  });
  const responseDurationMs = Date.now() - startedAt;

  if (!res.success) {
    set({ invoking: false, responseDurationMs, invokeError: res.error.message || TRANSPORT_INVOKE_FALLBACK });
    return;
  }

  set({
    invoking: false,
    response: res.data,
    responseDurationMs,
    outputViewContent: null,
    invokeError: null,
  });

  if (info.outputView?.hasView) {
    const outputRes = await api.fetchContract({
      path: info.outputView.href,
      domain: info.domain,
      headers,
      runtimeUrl,
    });
    if (outputRes.success) set({ outputViewContent: toViewResponse(outputRes.data) });
  }
}
