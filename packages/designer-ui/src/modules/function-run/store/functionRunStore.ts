import { create } from 'zustand';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import type { ContentTypeId, RequestTabId, RunMode } from '../functionRunPayload';
import type { FunctionExchange, FunctionInfo } from '../types/functionRun.types';

/**
 * A single module-level store, deliberately — one runner is mounted at a time
 * in any given JavaScript realm:
 *
 *  - In the web SPA the in-editor runner (`function/:group/:name`) and the
 *    standalone runner are sibling routes under one shell, so React Router
 *    mounts exactly one.
 *  - In the extension the designer and the standalone Quick Run panel are
 *    separate webviews, so each gets its own copy of this module anyway.
 *  - The runner is not offered when a function is opened as a nested modal
 *    (`ComponentEditorDialog`), which is the one place two could otherwise
 *    coexist.
 *
 * If any of those three stops being true — a split-pane editor, two runners in
 * one webview — this must become per-mount state (a store factory, or a keyed
 * map like `useQuickRunStore`'s `tabs`). Two runners sharing this singleton
 * would silently stomp each other's verb, payload and response.
 */

interface FunctionRunState {
  info: FunctionInfo | null;
  infoExchange: FunctionExchange | null;
  infoLoading: boolean;
  /** Populated when /info itself failed (403, 404, transport). */
  infoError: string | null;
  /**
   * True exactly when `infoError` reflects a 401/403 on `/info` — see
   * `readInfoExchange`'s own field of the same name. Lets the shell offer a
   * "Open Headers" shortcut alongside Retry only when that would actually
   * help, without re-deriving which statuses count from `infoError`'s text.
   */
  infoErrorIsAuthorization: boolean;

  verb: FunctionVerb | null;
  mode: RunMode;
  contentType: ContentTypeId;
  payload: Record<string, unknown>;
  viewFormData: Record<string, unknown>;
  /**
   * Free-text query string from the runner's dedicated query input (Fix 3),
   * e.g. `a=1&b=2`. Applies regardless of verb or mode; parsed at invoke
   * time via `parseQueryString`.
   */
  queryString: string;

  /** Scope F/I only. */
  workflowKey: string;
  instanceId: string;

  /**
   * The request tab the user last picked (Params / Headers / Body) — see
   * `resolveEffectiveRequestTab` in `functionRunPayload.ts` for the
   * computed-override that hides this value when it says `'body'` but the
   * selected verb carries none. Defaults to `'body'`, mirroring `mode`'s own
   * default of `'payload'`: once `/info` resolves to a body-bearing verb,
   * the Body tab activates on its own with no special-case wiring needed —
   * the same override that hides it also stops hiding it the moment it
   * would no longer need to.
   */
  activeRequestTab: RequestTabId;

  inputViewContent: unknown;
  outputViewContent: unknown;
  inputSchema: Record<string, unknown> | null;

  invoking: boolean;
  response: FunctionExchange | null;
  responseDurationMs: number | null;
  /**
   * Populated when invoke itself failed at the transport level (network
   * error, host rejected the request) — as opposed to a non-2xx `response`,
   * which is a normal outcome the function legitimately returned. Cleared at
   * the start of every invoke so a stale error never survives past the next
   * attempt.
   */
  invokeError: string | null;

  /**
   * The `${domain}::${functionKey}` this state was last loaded for. Lets
   * `resetIfNewIdentity` tell "a fresh mount for the same function" (survive)
   * apart from "a fresh mount for a *different* function" (clear) — a
   * genuine remount always calls it, but only the latter case is the bug it
   * exists to prevent (see the store's own singleton comment: this state
   * must never leak from one function into another).
   */
  loadedIdentity: string | null;

  /**
   * Patch the store. Excludes `set`/`reset` themselves from the patch type
   * so a caller cannot silently replace the store's own actions by spreading
   * an object that happens to carry a `set` or `reset` key.
   */
  set: (patch: Partial<Omit<FunctionRunState, 'set' | 'reset' | 'resetIfNewIdentity'>>) => void;
  reset: () => void;
  /**
   * Clears every field back to its initial value when `identity` differs
   * from whatever this singleton last loaded — a no-op the first time any
   * identity is ever recorded (nothing to clear yet) and a no-op when
   * `identity` matches what is already loaded (not a new function, just a
   * re-render). `FunctionRunShell` calls this once, synchronously, on its
   * very first render (a `useState` lazy initializer, not an effect — see
   * its own comment for why that specifically is what makes this testable
   * under this package's SSR-only test harness).
   */
  resetIfNewIdentity: (identity: string) => void;
}

type FunctionRunData = Omit<FunctionRunState, 'set' | 'reset' | 'resetIfNewIdentity'>;

/**
 * Builds a fresh initial-state object on every call. `payload` and
 * `viewFormData` are mutable objects — reusing one module-level constant
 * across every `reset()` would hand every reset (and the store's very first
 * state) the *same* object reference, so an in-place mutation slipping past
 * an immutable `set({ payload: {...} })` call on one run would silently
 * leak into the next run's "empty" payload. A factory function sidesteps
 * that by minting new `{}` literals each time.
 */
function createInitialState(): FunctionRunData {
  return {
    info: null,
    infoExchange: null,
    infoLoading: false,
    infoError: null,
    infoErrorIsAuthorization: false,

    verb: null,
    mode: 'payload',
    contentType: 'json',
    payload: {},
    viewFormData: {},
    queryString: '',

    workflowKey: '',
    instanceId: '',

    activeRequestTab: 'body',

    inputViewContent: null,
    outputViewContent: null,
    inputSchema: null,

    invoking: false,
    response: null,
    responseDurationMs: null,
    invokeError: null,

    loadedIdentity: null,
  };
}

export const useFunctionRunStore = create<FunctionRunState>((set, get) => ({
  ...createInitialState(),
  set: (patch) => set(patch),
  reset: () => set(createInitialState()),
  resetIfNewIdentity: (identity) => {
    const current = get().loadedIdentity;
    if (current !== null && current !== identity) {
      set({ ...createInitialState(), loadedIdentity: identity });
      return;
    }
    set({ loadedIdentity: identity });
  },
}));
