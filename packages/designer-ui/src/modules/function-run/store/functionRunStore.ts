import { create } from 'zustand';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import type { ContentTypeId, RunMode } from '../functionRunPayload';
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

  verb: FunctionVerb | null;
  mode: RunMode;
  contentType: ContentTypeId;
  payload: Record<string, unknown>;
  viewFormData: Record<string, unknown>;

  /** Scope F/I only. */
  workflowKey: string;
  instanceId: string;

  inputViewContent: unknown;
  outputViewContent: unknown;
  inputSchema: Record<string, unknown> | null;

  invoking: boolean;
  response: FunctionExchange | null;
  responseDurationMs: number | null;

  /**
   * Patch the store. Excludes `set`/`reset` themselves from the patch type
   * so a caller cannot silently replace the store's own actions by spreading
   * an object that happens to carry a `set` or `reset` key.
   */
  set: (patch: Partial<Omit<FunctionRunState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

type FunctionRunData = Omit<FunctionRunState, 'set' | 'reset'>;

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

    verb: null,
    mode: 'payload',
    contentType: 'json',
    payload: {},
    viewFormData: {},

    workflowKey: '',
    instanceId: '',

    inputViewContent: null,
    outputViewContent: null,
    inputSchema: null,

    invoking: false,
    response: null,
    responseDurationMs: null,
  };
}

export const useFunctionRunStore = create<FunctionRunState>((set) => ({
  ...createInitialState(),
  set: (patch) => set(patch),
  reset: () => set(createInitialState()),
}));
