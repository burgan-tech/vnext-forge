import { create } from 'zustand';
import type {
  ContextPanelTab,
  DataResponse,
  FlowLabelsMap,
  FunctionCatalogEntry,
  HistoryResponse,
  InstanceListItem,
  InstanceStatus,
  QuickRunInstance,
  QuickRunTab,
  SchemaResponse,
  StateResponse,
  TaskHistoryItem,
  TransitionInfo,
  ViewResponse,
} from '../types/quickrun.types';
import {
  INITIAL_INTERACTION,
  interactionReducer,
  type InteractionEvent,
  type InteractionPhase,
} from '../hooks/interactionMachine';
import type { PermissionCheckResult } from '../utils/permissionChecks';

interface QuickRunState {
  domain: string;
  workflowKey: string;
  environmentName?: string;
  environmentUrl?: string;

  tabs: QuickRunTab[];
  activeTabId: string | null;

  instances: Map<string, QuickRunInstance>;
  instanceList: InstanceListItem[];
  instanceListLoading: boolean;

  activeState: StateResponse | null;
  activeStateLoading: boolean;
  /**
   * The last *whole* State Function (LongPoll) response body, as received.
   *
   * Deliberately separate from `activeState`, which is not a faithful record
   * of the last response: a busy round (`status === 'B'`) only reaches
   * `patchActiveState`, so that round's `transitions` / `view` / `interaction`
   * / `responseHeaders` never land in `activeState` at all. The Raw tab exists
   * to answer "what did the engine actually return", so it reads this instead.
   *
   * `responseHeaders` and `notModified` on the stored object are added by
   * Forge (`quickrun.service.getState`), not sent by the engine; every other
   * field is an unfiltered pass-through of the parsed body.
   */
  lastStateResponse: StateResponse | null;
  lastStateReceivedAt: number | null;
  /**
   * The most recent round was a 304 — the engine sent no body, so
   * `lastStateResponse` is the previous full one. Surfaced as a note rather
   * than blanking the tab.
   */
  lastStateNotModified: boolean;
  /**
   * Surfacing slot for `getState` polling failures (runtime 4xx/5xx,
   * connection errors). The dashboard renders it with `RuntimeErrorBanner`
   * so users see *why* polling stopped. Cleared on every successful poll round.
   */
  activeStateError:
    | { code: string; message: string; details?: Record<string, unknown> }
    | null;

  /** Opt-in "Check permissions for role" (B6). A user preference — survives instance switches. */
  permissionChecksEnabled: boolean;
  /** Last opt-in check, keyed by `permissionCacheKey`. Instance-scoped. */
  permissionChecks: PermissionCheckResult | null;
  setPermissionChecksEnabled: (enabled: boolean) => void;
  setPermissionChecks: (result: PermissionCheckResult | null) => void;

  stateView: ViewResponse | null;
  stateViewLoading: boolean;
  stateViewError: boolean;

  activeView: ViewResponse | null;
  activeViewLoading: boolean;

  activeData: DataResponse | null;
  activeDataLoading: boolean;

  activeSchema: SchemaResponse | null;
  activeSchemaLoading: boolean;

  activeHistory: HistoryResponse | null;
  activeHistoryLoading: boolean;

  /** `…/functions/tasks` of the active instance; loaded by the Tasks tab. */
  activeTaskHistory: TaskHistoryItem[] | null;
  activeTaskHistoryLoading: boolean;
  activeTaskHistoryError: { code: string; message: string; details?: Record<string, unknown> } | null;

  /**
   * Functions reachable on the active instance, from
   * `quickrun/getFunctionCatalog`. Fetched once per instance — only when the
   * state response declares `functions.hasFunctions` — and cleared with the
   * rest of the instance-scoped caches, never refreshed per poll round.
   */
  functionCatalog: FunctionCatalogEntry[] | null;
  functionCatalogLoading: boolean;
  functionCatalogError: string | null;
  selectedFunctionName: string | null;

  contextPanelTab: ContextPanelTab;

  transitionDialogOpen: boolean;
  transitionDialogTarget: TransitionInfo | null;

  globalHeaders: Record<string, string>;
  sessionHeaders: Record<string, string>;
  /**
   * Forge-wide headers from `useToolHeadersStore`, mirrored in here so the
   * live-getter pattern already used for `globalHeaders`/`sessionHeaders` by
   * the pseudo-ui delegate (`InstanceDashboard`/`TransitionDialog`) can read
   * them the same way. `QuickRunShell` is the only writer — see its
   * `useToolHeadersStore` sync effect.
   */
  toolWideHeaders: Record<string, string>;

  pollingInstanceId: string | null;
  pollingConfig: { retryCount: number; intervalMs: number };

  /**
   * Long-poll interaction phase of the active instance (spec D3) — see
   * `hooks/interactionMachine.ts`. Reset with the instance-scoped caches.
   */
  interaction: InteractionPhase;

  runtimeHealth: 'healthy' | 'unhealthy' | 'unknown';
  runtimeDomain: string | null;
  /**
   * Version the runtime reports (`/health` body or `X-App-Version`), e.g.
   * `0.0.99`. Null until probed — callers treat null as "unknown" and use
   * shape detection / try-then-fallback rather than guessing.
   */
  runtimeVersion: string | null;

  flowLabels: FlowLabelsMap | null;

  /**
   * Last-seen ETag per quickrun function kind, scoped to the *active*
   * instance. Echoed back as `If-None-Match` on the next request for that
   * function so an unchanged upstream resource can short-circuit to a 304.
   * Reset whenever the active instance changes (new tab, tab switch,
   * workflow context switch) so a stale ETag from a different instance is
   * never sent for a different instance's resource.
   */
  etags: { state?: string; data?: string; schema?: string };

  setWorkflowContext: (domain: string, workflowKey: string, envName?: string, envUrl?: string) => void;
  addTab: (tab: QuickRunTab) => void;
  removeTab: (instanceId: string) => void;
  removeAllTabs: () => void;
  removeOtherTabs: (instanceId: string) => void;
  setActiveTab: (instanceId: string) => void;
  setContextPanelTab: (tab: ContextPanelTab) => void;

  addInstance: (instance: QuickRunInstance) => void;
  updateInstanceStatus: (instanceId: string, status: InstanceStatus, state?: string) => void;
  updateInstanceState: (instanceId: string, stateResponse: StateResponse) => void;

  setActiveState: (state: StateResponse | null) => void;
  /**
   * Record a State Function round. `notModified` rounds carry no body, so
   * `response` is ignored for those and only the timestamp/flag move.
   */
  setLastStateResponse: (response: StateResponse | null, notModified: boolean) => void;
  patchActiveState: (patch: { status: InstanceStatus; state?: string }) => void;
  setActiveStateLoading: (loading: boolean) => void;
  setActiveStateError: (
    error:
      | { code: string; message: string; details?: Record<string, unknown> }
      | null,
  ) => void;
  setStateView: (view: ViewResponse | null) => void;
  setStateViewLoading: (loading: boolean) => void;
  setStateViewError: (error: boolean) => void;
  setActiveView: (view: ViewResponse | null) => void;
  setActiveViewLoading: (loading: boolean) => void;
  setActiveData: (data: DataResponse | null) => void;
  setActiveDataLoading: (loading: boolean) => void;
  setActiveSchema: (schema: SchemaResponse | null) => void;
  setActiveSchemaLoading: (loading: boolean) => void;
  setActiveHistory: (history: HistoryResponse | null) => void;
  setActiveHistoryLoading: (loading: boolean) => void;

  setActiveTaskHistory: (items: TaskHistoryItem[] | null) => void;
  setActiveTaskHistoryLoading: (loading: boolean) => void;
  setActiveTaskHistoryError: (error: { code: string; message: string; details?: Record<string, unknown> } | null) => void;

  setFunctionCatalog: (entries: FunctionCatalogEntry[] | null) => void;
  setFunctionCatalogLoading: (loading: boolean) => void;
  setFunctionCatalogError: (error: string | null) => void;
  setSelectedFunctionName: (name: string | null) => void;

  setInstanceList: (items: InstanceListItem[]) => void;
  setInstanceListLoading: (loading: boolean) => void;

  openTransitionDialog: (transition: TransitionInfo) => void;
  openManualTransitionDialog: () => void;
  closeTransitionDialog: () => void;

  setGlobalHeaders: (headers: Record<string, string>) => void;
  setSessionHeaders: (headers: Record<string, string>) => void;
  setToolWideHeaders: (headers: Record<string, string>) => void;
  setPollingInstanceId: (id: string | null) => void;
  setPollingConfig: (config: { retryCount: number; intervalMs: number }) => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  setRuntimeHealth: (health: 'healthy' | 'unhealthy' | 'unknown') => void;
  setRuntimeDomain: (domain: string | null) => void;
  setRuntimeVersion: (version: string | null) => void;
  setFlowLabels: (labels: FlowLabelsMap | null) => void;

  setEtag: (fn: 'state' | 'data' | 'schema', etag: string | undefined) => void;
  resetEtags: () => void;
  /**
   * Everything cached *for one specific instance*: the ETag echoes plus the
   * last raw state response and the function catalog. Called wherever the
   * active instance changes, so a previous instance's payload can never show
   * under a new one.
   */
  resetInstanceScopedCaches: () => void;
}

export const useQuickRunStore = create<QuickRunState>((set, get) => ({
  domain: '',
  workflowKey: '',
  environmentName: undefined,
  environmentUrl: undefined,

  tabs: [],
  activeTabId: null,

  instances: new Map(),
  instanceList: [],
  instanceListLoading: false,

  activeState: null,
  activeStateLoading: false,
  activeStateError: null,
  permissionChecksEnabled: false,
  permissionChecks: null,

  lastStateResponse: null,
  lastStateReceivedAt: null,
  lastStateNotModified: false,

  stateView: null,
  stateViewLoading: false,
  stateViewError: false,

  activeView: null,
  activeViewLoading: false,

  activeData: null,
  activeDataLoading: false,

  activeSchema: null,
  activeSchemaLoading: false,

  activeHistory: null,
  activeHistoryLoading: false,

  activeTaskHistory: null,
  activeTaskHistoryLoading: false,
  activeTaskHistoryError: null,

  functionCatalog: null,
  functionCatalogLoading: false,
  functionCatalogError: null,
  selectedFunctionName: null,

  contextPanelTab: 'data',

  transitionDialogOpen: false,
  transitionDialogTarget: null,

  globalHeaders: {},
  sessionHeaders: {},
  toolWideHeaders: {},

  pollingInstanceId: null,
  pollingConfig: { retryCount: 15, intervalMs: 4000 },
  interaction: INITIAL_INTERACTION,

  runtimeHealth: 'unknown',
  runtimeDomain: null,
  runtimeVersion: null,

  flowLabels: null,

  etags: {},

  setWorkflowContext: (domain, workflowKey, envName, envUrl) => {
    set({
      domain,
      workflowKey,
      environmentName: envName,
      environmentUrl: envUrl,
      tabs: [],
      activeTabId: null,
      instances: new Map(),
      instanceList: [],
      activeState: null,
      activeStateError: null,
      stateView: null,
      stateViewError: false,
      activeView: null,
      activeData: null,
      activeSchema: null,
      activeHistory: null,
      transitionDialogOpen: false,
      transitionDialogTarget: null,
      pollingInstanceId: null,
      flowLabels: null,
    });
    get().resetInstanceScopedCaches();
  },

  addTab: (tab) => {
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.instanceId,
    }));
    // New instance becomes active — its resources have never been
    // fetched, so any cached ETag from the previously-active instance
    // must not be echoed back for it.
    get().resetInstanceScopedCaches();
  },

  removeTab: (instanceId) => {
    const prevActiveTabId = get().activeTabId;
    set((state) => {
      const tabs = state.tabs.filter((t) => t.instanceId !== instanceId);
      const activeTabId =
        state.activeTabId === instanceId
          ? (tabs[tabs.length - 1]?.instanceId ?? null)
          : state.activeTabId;
      return { tabs, activeTabId };
    });
    // Only reset the ETag cache when the active instance actually
    // changed as a result of closing this tab.
    if (get().activeTabId !== prevActiveTabId) get().resetInstanceScopedCaches();
  },

  removeAllTabs: () => {
    set({
      tabs: [],
      activeTabId: null,
      activeState: null,
      activeStateError: null,
      stateView: null,
      activeView: null,
      activeData: null,
      activeSchema: null,
      activeHistory: null,
    });
    get().resetInstanceScopedCaches();
  },

  removeOtherTabs: (instanceId) => {
    const prevActiveTabId = get().activeTabId;
    set((state) => {
      const tabs = state.tabs.filter((t) => t.instanceId === instanceId);
      return { tabs, activeTabId: instanceId };
    });
    if (prevActiveTabId !== instanceId) get().resetInstanceScopedCaches();
  },

  setActiveTab: (instanceId) => {
    const prevActiveTabId = get().activeTabId;
    set({ activeTabId: instanceId });
    // Switching to a different instance's tab — an ETag captured for
    // the previously-active instance must never be sent for this one.
    if (prevActiveTabId !== instanceId) get().resetInstanceScopedCaches();
  },
  setContextPanelTab: (tab) => set({ contextPanelTab: tab }),

  addInstance: (instance) =>
    set((state) => {
      const instances = new Map(state.instances);
      instances.set(instance.id, instance);
      return { instances };
    }),

  updateInstanceStatus: (instanceId, status, currentState) =>
    set((state) => {
      const instances = new Map(state.instances);
      const existing = instances.get(instanceId);
      if (existing) {
        instances.set(instanceId, { ...existing, status, effectiveStatus: undefined, currentState: currentState ?? existing.currentState });
      }
      return { instances };
    }),

  updateInstanceState: (instanceId, stateResponse) =>
    set((state) => {
      const instances = new Map(state.instances);
      const existing = instances.get(instanceId);
      if (existing) {
        instances.set(instanceId, {
          ...existing,
          status: stateResponse.status,
          effectiveStatus: undefined,
          currentState: stateResponse.state,
          transitions: stateResponse.transitions,
          sharedTransitions: stateResponse.sharedTransitions,
        });
      }
      return { instances };
    }),

  setActiveState: (activeState) => set({ activeState }),
  setLastStateResponse: (response, notModified) =>
    set(
      notModified
        ? // A 304 carries no body — keep the last full one and only record
          // that this round did not change it.
          { lastStateReceivedAt: Date.now(), lastStateNotModified: true }
        : { lastStateResponse: response, lastStateReceivedAt: Date.now(), lastStateNotModified: false },
    ),
  patchActiveState: (patch) =>
    set((state) => {
      if (!state.activeState) return state;
      return {
        activeState: { ...state.activeState, status: patch.status, state: patch.state ?? state.activeState.state },
      };
    }),
  setActiveStateLoading: (activeStateLoading) => set({ activeStateLoading }),
  setActiveStateError: (activeStateError) => set({ activeStateError }),
  setPermissionChecksEnabled: (permissionChecksEnabled) => set({ permissionChecksEnabled }),
  setPermissionChecks: (permissionChecks) => set({ permissionChecks }),
  setStateView: (stateView) => set({ stateView }),
  setStateViewLoading: (stateViewLoading) => set({ stateViewLoading }),
  setStateViewError: (stateViewError) => set({ stateViewError }),
  setActiveView: (activeView) => set({ activeView }),
  setActiveViewLoading: (activeViewLoading) => set({ activeViewLoading }),
  setActiveData: (activeData) => set({ activeData }),
  setActiveDataLoading: (activeDataLoading) => set({ activeDataLoading }),
  setActiveSchema: (activeSchema) => set({ activeSchema }),
  setActiveSchemaLoading: (activeSchemaLoading) => set({ activeSchemaLoading }),
  setActiveHistory: (activeHistory) => set({ activeHistory }),
  setActiveHistoryLoading: (activeHistoryLoading) => set({ activeHistoryLoading }),

  setActiveTaskHistory: (activeTaskHistory) => set({ activeTaskHistory }),
  setActiveTaskHistoryLoading: (activeTaskHistoryLoading) => set({ activeTaskHistoryLoading }),
  setActiveTaskHistoryError: (activeTaskHistoryError) => set({ activeTaskHistoryError }),

  setFunctionCatalog: (functionCatalog) => set({ functionCatalog }),
  setFunctionCatalogLoading: (functionCatalogLoading) => set({ functionCatalogLoading }),
  setFunctionCatalogError: (functionCatalogError) => set({ functionCatalogError }),
  setSelectedFunctionName: (selectedFunctionName) => set({ selectedFunctionName }),

  setInstanceList: (instanceList) => set({ instanceList }),
  setInstanceListLoading: (instanceListLoading) => set({ instanceListLoading }),

  openTransitionDialog: (transition) => set({ transitionDialogOpen: true, transitionDialogTarget: transition }),
  openManualTransitionDialog: () => set({ transitionDialogOpen: true, transitionDialogTarget: null }),
  closeTransitionDialog: () => set({ transitionDialogOpen: false, transitionDialogTarget: null }),

  setGlobalHeaders: (globalHeaders) => set({ globalHeaders }),
  setSessionHeaders: (sessionHeaders) => set({ sessionHeaders }),
  setToolWideHeaders: (toolWideHeaders) => set({ toolWideHeaders }),
  setPollingInstanceId: (pollingInstanceId) => set({ pollingInstanceId }),
  setPollingConfig: (pollingConfig) => set({ pollingConfig }),
  dispatchInteraction: (event) => set((state) => ({ interaction: interactionReducer(state.interaction, event) })),
  setRuntimeHealth: (runtimeHealth) => set({ runtimeHealth }),
  setRuntimeDomain: (runtimeDomain) => set({ runtimeDomain }),
  setRuntimeVersion: (runtimeVersion) => set({ runtimeVersion }),
  setFlowLabels: (flowLabels) => set({ flowLabels }),

  setEtag: (fn, etag) => set((state) => ({ etags: { ...state.etags, [fn]: etag } })),
  resetEtags: () => set({ etags: {} }),
  resetInstanceScopedCaches: () =>
    set({
      etags: {},
      lastStateResponse: null,
      lastStateReceivedAt: null,
      lastStateNotModified: false,
      functionCatalog: null,
      functionCatalogLoading: false,
      functionCatalogError: null,
      selectedFunctionName: null,
      interaction: INITIAL_INTERACTION,
      permissionChecks: null,
      activeTaskHistory: null,
      activeTaskHistoryLoading: false,
      activeTaskHistoryError: null,
    }),
}));
