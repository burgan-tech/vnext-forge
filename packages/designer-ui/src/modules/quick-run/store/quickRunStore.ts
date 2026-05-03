import { create } from 'zustand';
import type {
  ContextPanelTab,
  DataResponse,
  FlowLabelsMap,
  HistoryResponse,
  InstanceListItem,
  InstanceStatus,
  QuickRunInstance,
  QuickRunTab,
  StateResponse,
  TransitionInfo,
  ViewResponse,
} from '../types/quickrun.types';

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

  stateView: ViewResponse | null;
  stateViewLoading: boolean;
  stateViewError: boolean;

  activeView: ViewResponse | null;
  activeViewLoading: boolean;

  activeData: DataResponse | null;
  activeDataLoading: boolean;

  activeHistory: HistoryResponse | null;
  activeHistoryLoading: boolean;

  contextPanelTab: ContextPanelTab;

  transitionDialogOpen: boolean;
  transitionDialogTarget: TransitionInfo | null;

  globalHeaders: Record<string, string>;
  sessionHeaders: Record<string, string>;

  pollingInstanceId: string | null;
  pollingConfig: { retryCount: number; intervalMs: number };

  runtimeHealth: 'healthy' | 'unhealthy' | 'unknown';

  flowLabels: FlowLabelsMap | null;

  setWorkflowContext: (domain: string, workflowKey: string, envName?: string, envUrl?: string) => void;
  addTab: (tab: QuickRunTab) => void;
  removeTab: (instanceId: string) => void;
  setActiveTab: (instanceId: string) => void;
  setContextPanelTab: (tab: ContextPanelTab) => void;

  addInstance: (instance: QuickRunInstance) => void;
  updateInstanceStatus: (instanceId: string, status: InstanceStatus, state?: string) => void;
  updateInstanceState: (instanceId: string, stateResponse: StateResponse) => void;

  setActiveState: (state: StateResponse | null) => void;
  setActiveStateLoading: (loading: boolean) => void;
  setStateView: (view: ViewResponse | null) => void;
  setStateViewLoading: (loading: boolean) => void;
  setStateViewError: (error: boolean) => void;
  setActiveView: (view: ViewResponse | null) => void;
  setActiveViewLoading: (loading: boolean) => void;
  setActiveData: (data: DataResponse | null) => void;
  setActiveDataLoading: (loading: boolean) => void;
  setActiveHistory: (history: HistoryResponse | null) => void;
  setActiveHistoryLoading: (loading: boolean) => void;

  setInstanceList: (items: InstanceListItem[]) => void;
  setInstanceListLoading: (loading: boolean) => void;

  openTransitionDialog: (transition: TransitionInfo) => void;
  closeTransitionDialog: () => void;

  setGlobalHeaders: (headers: Record<string, string>) => void;
  setSessionHeaders: (headers: Record<string, string>) => void;
  setPollingInstanceId: (id: string | null) => void;
  setPollingConfig: (config: { retryCount: number; intervalMs: number }) => void;
  setRuntimeHealth: (health: 'healthy' | 'unhealthy' | 'unknown') => void;
  setFlowLabels: (labels: FlowLabelsMap | null) => void;
}

export const useQuickRunStore = create<QuickRunState>((set) => ({
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

  stateView: null,
  stateViewLoading: false,
  stateViewError: false,

  activeView: null,
  activeViewLoading: false,

  activeData: null,
  activeDataLoading: false,

  activeHistory: null,
  activeHistoryLoading: false,

  contextPanelTab: 'view',

  transitionDialogOpen: false,
  transitionDialogTarget: null,

  globalHeaders: {},
  sessionHeaders: {},

  pollingInstanceId: null,
  pollingConfig: { retryCount: 12, intervalMs: 500 },

  runtimeHealth: 'unknown',

  flowLabels: null,

  setWorkflowContext: (domain, workflowKey, envName, envUrl) =>
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
      stateView: null,
      stateViewError: false,
      activeView: null,
      activeData: null,
      activeHistory: null,
      transitionDialogOpen: false,
      transitionDialogTarget: null,
      pollingInstanceId: null,
      flowLabels: null,
    }),

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.instanceId,
    })),

  removeTab: (instanceId) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.instanceId !== instanceId);
      const activeTabId =
        state.activeTabId === instanceId
          ? (tabs[tabs.length - 1]?.instanceId ?? null)
          : state.activeTabId;
      return { tabs, activeTabId };
    }),

  setActiveTab: (instanceId) => set({ activeTabId: instanceId }),
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
        instances.set(instanceId, { ...existing, status, currentState: currentState ?? existing.currentState });
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
          currentState: stateResponse.state,
          transitions: stateResponse.transitions,
          sharedTransitions: stateResponse.sharedTransitions,
        });
      }
      return { instances };
    }),

  setActiveState: (activeState) => set({ activeState }),
  setActiveStateLoading: (activeStateLoading) => set({ activeStateLoading }),
  setStateView: (stateView) => set({ stateView }),
  setStateViewLoading: (stateViewLoading) => set({ stateViewLoading }),
  setStateViewError: (stateViewError) => set({ stateViewError }),
  setActiveView: (activeView) => set({ activeView }),
  setActiveViewLoading: (activeViewLoading) => set({ activeViewLoading }),
  setActiveData: (activeData) => set({ activeData }),
  setActiveDataLoading: (activeDataLoading) => set({ activeDataLoading }),
  setActiveHistory: (activeHistory) => set({ activeHistory }),
  setActiveHistoryLoading: (activeHistoryLoading) => set({ activeHistoryLoading }),

  setInstanceList: (instanceList) => set({ instanceList }),
  setInstanceListLoading: (instanceListLoading) => set({ instanceListLoading }),

  openTransitionDialog: (transition) => set({ transitionDialogOpen: true, transitionDialogTarget: transition }),
  closeTransitionDialog: () => set({ transitionDialogOpen: false, transitionDialogTarget: null }),

  setGlobalHeaders: (globalHeaders) => set({ globalHeaders }),
  setSessionHeaders: (sessionHeaders) => set({ sessionHeaders }),
  setPollingInstanceId: (pollingInstanceId) => set({ pollingInstanceId }),
  setPollingConfig: (pollingConfig) => set({ pollingConfig }),
  setRuntimeHealth: (runtimeHealth) => set({ runtimeHealth }),
  setFlowLabels: (flowLabels) => set({ flowLabels }),
}));
