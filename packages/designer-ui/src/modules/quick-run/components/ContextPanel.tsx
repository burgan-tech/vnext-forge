import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { extractEtag } from '../etagFromResponse';
import { currentDataTarget } from '../hooks/currentDataTarget';
import { quickRunHeadersFromState } from '../pseudo-ui/mergeQuickRunHeaders';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { dataTargetKey, type DataTarget } from '../utils/dataTarget';
import { transitionDisplayLabel } from '../utils/displayLabels';
import { useRuntimeSupports } from '../utils/runtimeFeatures';
import {
  type ContextPanelTab,
  type DataResponse,
  type OpenSubFlowTarget,
  type StateResponse,
} from '../types/quickrun.types';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { CorrelationsTabContent } from './CorrelationsTab';
import { type ElementMetricsLoader } from './ElementMetrics';
import { HistoryTabContent } from './HistoryTab';
import { TasksTabContent } from './TasksTab';
import { FileHandleChips, type FileHandleChipsProps } from '../file-fields/FileHandleChips';

const TABS: { id: ContextPanelTab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'history', label: 'History' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'correlations', label: 'Correlations' },
  { id: 'raw', label: 'Raw' },
];

export interface ContextPanelProps {
  /**
   * Open a correlation's sub-flow — its Quick Runner or its definition in the
   * designer. Forwarded from `QuickRunShell`; when omitted the Correlations
   * tab lists correlations without action buttons.
   */
  onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void;
}

export function ContextPanel({ onOpenSubFlowTarget }: ContextPanelProps) {
  const contextPanelTab = useQuickRunStore((s) => s.contextPanelTab);
  const setContextPanelTab = useQuickRunStore((s) => s.setContextPanelTab);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const historyNone = useQuickRunStore((s) => s.flowHistoryMode === 'none');
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const toolWideHeaders = useQuickRunStore((s) => s.toolWideHeaders);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const activeState = useQuickRunStore((s) => s.activeState);
  const activeStateLoading = useQuickRunStore((s) => s.activeStateLoading);
  const pollingInstanceId = useQuickRunStore((s) => s.pollingInstanceId);

  const activeData = useQuickRunStore((s) => s.activeData);
  const activeDataLoading = useQuickRunStore((s) => s.activeDataLoading);
  const dataTarget = useQuickRunStore((s) => s.dataTarget);
  const setActiveData = useQuickRunStore((s) => s.setActiveData);
  const setActiveDataLoading = useQuickRunStore((s) => s.setActiveDataLoading);

  const lastStateResponse = useQuickRunStore((s) => s.lastStateResponse);
  const lastStateReceivedAt = useQuickRunStore((s) => s.lastStateReceivedAt);
  const lastStateNotModified = useQuickRunStore((s) => s.lastStateNotModified);

  const activeHistory = useQuickRunStore((s) => s.activeHistory);
  const activeHistoryLoading = useQuickRunStore((s) => s.activeHistoryLoading);
  const setActiveHistory = useQuickRunStore((s) => s.setActiveHistory);
  const setActiveHistoryLoading = useQuickRunStore((s) => s.setActiveHistoryLoading);

  const activeTaskHistory = useQuickRunStore((s) => s.activeTaskHistory);
  const activeTaskHistoryLoading = useQuickRunStore((s) => s.activeTaskHistoryLoading);
  const activeTaskHistoryError = useQuickRunStore((s) => s.activeTaskHistoryError);
  const stateEtag = activeState?.eTag;
  const flowLabels = useQuickRunStore((s) => s.flowLabels);
  const transitionLabel = useCallback(
    (transitionKey: string, fromState: string) =>
      transitionDisplayLabel({ name: transitionKey }, flowLabels, fromState),
    [flowLabels],
  );
  const runtimeVersion = useQuickRunStore((s) => s.runtimeVersion);

  // Transition / state attempts (runtime 0.0.99 only — older runtimes 404).
  const metricsSupported = useRuntimeSupports('elementMetrics');
  const loadElementMetrics = useMemo<ElementMetricsLoader | undefined>(() => {
    if (metricsSupported !== true || !activeTabId || !domain || !workflowKey) return undefined;
    return (kind, key) => {
      const params = {
        domain,
        workflowKey,
        instanceId: activeTabId,
        key,
        headers: quickRunHeadersFromState({ globalHeaders, sessionHeaders, toolWideHeaders }),
        runtimeUrl: environmentUrl,
      };
      return kind === 'transition' ? QuickRunApi.getTransitionMetrics(params) : QuickRunApi.getStateMetrics(params);
    };
  }, [metricsSupported, activeTabId, domain, workflowKey, globalHeaders, sessionHeaders, toolWideHeaders, environmentUrl]);

  // Whole correlation tree, on demand (runtime 0.0.99 instance-correlation,
  // hierarchy on older runtimes — the host picks by version).
  const loadCorrelationTree = useMemo(() => {
    if (!activeTabId || !domain || !workflowKey) return undefined;
    return () =>
      QuickRunApi.getCorrelationTree({
        domain,
        workflowKey,
        instanceId: activeTabId,
        ...(runtimeVersion ? { runtimeVersion } : {}),
        headers: quickRunHeadersFromState({ globalHeaders, sessionHeaders, toolWideHeaders }),
        runtimeUrl: environmentUrl,
      });
  }, [activeTabId, domain, workflowKey, runtimeVersion, globalHeaders, sessionHeaders, toolWideHeaders, environmentUrl]);

  const loadData = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setActiveDataLoading(true);
    // The leaf open SubFlow's data (the runtime keeps `data.href` on the
    // parent). The ETag is read after tracking the target, which drops a
    // moved target's one; an answer whose target moved meanwhile is dropped.
    const own = { domain, workflowKey, instanceId: activeTabId };
    const target = currentDataTarget(own);
    const targetKey = dataTargetKey(target);
    useQuickRunStore.getState().setDataTarget(target);
    const isStale = () => dataTargetKey(currentDataTarget(own)) !== targetKey;
    try {
      const ifNoneMatch = useQuickRunStore.getState().etags.data;
      const response = await QuickRunApi.getData({
        domain: target.domain,
        workflowKey: target.workflowKey,
        instanceId: target.instanceId,
        ifNoneMatch,
        headers: globalHeaders,
        runtimeUrl: environmentUrl,
      });
      if (isStale()) {
        // Dropped: the target moved during the round.
      } else if (response.success) {
        if (response.data.notModified) {
          // 304: the cached activeData is still current — keep it.
        } else {
          useQuickRunStore.getState().setEtag('data', extractEtag(response.data));
          setActiveData(response.data);
        }
      } else {
        // Invalidate the cached ETag along with the data: otherwise the
        // next getData would echo a still-valid ETag, the server would
        // correctly 304, and the "keep cache" branch above would keep
        // this `null` forever — stuck until the user switches tabs.
        // Clearing it here makes the next attempt unconditional so a
        // transient failure self-heals, as it did before ETags existed.
        useQuickRunStore.getState().setEtag('data', undefined);
        setActiveData(null);
      }
    } catch {
      if (!isStale()) {
        useQuickRunStore.getState().setEtag('data', undefined);
        setActiveData(null);
      }
    }
    setActiveDataLoading(false);
  }, [activeTabId, domain, workflowKey, globalHeaders, environmentUrl, setActiveData, setActiveDataLoading]);

  const loadHistory = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setActiveHistoryLoading(true);
    try {
      const response = await QuickRunApi.getHistory({ domain, workflowKey, instanceId: activeTabId, headers: globalHeaders, runtimeUrl: environmentUrl });
      if (response.success) {
        setActiveHistory(response.data);
      } else {
        setActiveHistory(null);
      }
    } catch {
      setActiveHistory(null);
    }
    setActiveHistoryLoading(false);
  }, [activeTabId, domain, workflowKey, globalHeaders, environmentUrl, setActiveHistory, setActiveHistoryLoading]);

  // The shared Quick Run header rule (tool-wide < global < session).
  const taskHeaders = useMemo(
    () => quickRunHeadersFromState({ globalHeaders, sessionHeaders, toolWideHeaders }),
    [globalHeaders, sessionHeaders, toolWideHeaders],
  );
  // Bumped per Tasks load: a load superseded by a newer one, or whose
  // instance is no longer active, must not write its result, error or
  // loading flag.
  const taskLoadSeqRef = useRef(0);

  const loadTasks = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    const seq = ++taskLoadSeqRef.current;
    const instanceId = activeTabId;
    const isCurrent = () =>
      taskLoadSeqRef.current === seq && useQuickRunStore.getState().activeTabId === instanceId;
    const store = useQuickRunStore.getState();
    store.setActiveTaskHistoryLoading(true);
    store.setActiveTaskHistoryError(null);
    try {
      const response = await QuickRunApi.getTaskHistory({ domain, workflowKey, instanceId, headers: taskHeaders, runtimeUrl: environmentUrl });
      if (!isCurrent()) return;
      if (response.success) {
        store.setActiveTaskHistory(response.data.items);
        store.setActiveTaskHistoryError(null);
      } else {
        store.setActiveTaskHistoryError(response.error);
      }
    } catch (err) {
      if (!isCurrent()) return;
      store.setActiveTaskHistoryError({ code: 'THROWN', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (isCurrent()) useQuickRunStore.getState().setActiveTaskHistoryLoading(false);
    }
  }, [activeTabId, domain, workflowKey, taskHeaders, environmentUrl]);

  useEffect(() => {
    if (!activeTabId || pollingInstanceId) return;
    switch (contextPanelTab) {
      case 'data':
        void loadData();
        break;
      case 'history':
        void loadHistory();
        break;
    }
  }, [contextPanelTab, activeTabId, pollingInstanceId, loadData, loadHistory]);

  // Tasks: load when the tab opens and whenever the state's eTag moves
  // (a new transition ran), but never during a poll round.
  useEffect(() => {
    if (contextPanelTab !== 'tasks' || !activeTabId || pollingInstanceId) return;
    void loadTasks();
  }, [contextPanelTab, activeTabId, pollingInstanceId, stateEtag, loadTasks]);

  const prevStateLoadingRef = useRef(activeStateLoading);
  useEffect(() => {
    const wasLoading = prevStateLoadingRef.current;
    prevStateLoadingRef.current = activeStateLoading;
    if (wasLoading && !activeStateLoading && activeTabId && !pollingInstanceId) {
      if (contextPanelTab === 'history') void loadHistory();
      if (contextPanelTab === 'data') void loadData();
    }
  }, [activeStateLoading, activeTabId, contextPanelTab, pollingInstanceId, loadHistory, loadData]);

  if (!activeTabId) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-[var(--vscode-sideBar-background,#252526)] text-xs text-[var(--vscode-descriptionForeground)]">
        No instance selected
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--vscode-sideBar-background,#252526)]">
      {/* Tab strip */}
      <div className="flex border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBarSectionHeader-background,transparent)]" role="tablist" aria-label="Context details">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`quickrun-tab-${tab.id}`}
            aria-selected={contextPanelTab === tab.id}
            aria-controls={`quickrun-tabpanel-${tab.id}`}
            tabIndex={contextPanelTab === tab.id ? 0 : -1}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] ${
              contextPanelTab === tab.id
                ? 'border-b-2 border-b-[var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder))] text-[var(--vscode-foreground)]'
                : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
            }`}
            onClick={() => setContextPanelTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        className="flex flex-1 flex-col overflow-hidden p-3"
        role="tabpanel"
        id={`quickrun-tabpanel-${contextPanelTab}`}
        aria-labelledby={`quickrun-tab-${contextPanelTab}`}
      >
        {contextPanelTab === 'data' && (
          <DataTabContent
            // Remount on a new target: the switch goes back to `Active flow`.
            key={dataTarget ? dataTargetKey(dataTarget) : 'none'}
            target={dataTarget}
            loadMainData={() =>
              loadMainInstanceData({
                domain,
                workflowKey,
                instanceId: activeTabId,
                headers: globalHeaders,
                ...(environmentUrl ? { runtimeUrl: environmentUrl } : {}),
              })
            }
            data={activeData}
            loading={activeDataLoading}
            historyNone={historyNone}
            fileContext={
              activeTabId
                ? {
                    domain,
                    workflowKey,
                    instanceId: activeTabId,
                    headers: globalHeaders,
                    ...(environmentUrl ? { runtimeUrl: environmentUrl } : {}),
                  }
                : undefined
            }
          />
        )}
        {contextPanelTab === 'history' && (
          <HistoryTabContent
            key={activeTabId ?? 'none'}
            history={activeHistory}
            loading={activeHistoryLoading}
            {...(loadElementMetrics ? { loadMetrics: loadElementMetrics } : {})}
            tasks={activeTaskHistory}
            transitionLabel={transitionLabel}
            historyNone={historyNone}
          />
        )}
        {contextPanelTab === 'tasks' && (
          <TasksTabContent
            items={activeTaskHistory}
            loading={activeTaskHistoryLoading}
            error={activeTaskHistoryError}
            transitionLabel={transitionLabel}
            historyNone={historyNone}
          />
        )}
        {contextPanelTab === 'correlations' && (
          <CorrelationsTabContent
            key={activeTabId ?? 'none'}
            activeCorrelations={activeState?.activeCorrelations}
            correlations={activeState?.correlations}
            {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})}
            {...(loadCorrelationTree ? { loadTree: loadCorrelationTree } : {})}
          />
        )}
        {contextPanelTab === 'raw' && (
          <RawTabContent
            response={lastStateResponse}
            receivedAt={lastStateReceivedAt}
            notModified={lastStateNotModified}
          />
        )}
      </div>
    </aside>
  );
}

/** Which instance the Data tab shows while a sub-flow is open. */
export type DataTabSource = 'active' | 'main';

/**
 * The main instance's data for the Data tab's `Main instance` switch —
 * fetched unconditionally (no If-None-Match) and returned to the caller,
 * never written to `activeData`, which keeps feeding the view and its
 * binding context. `null` on failure.
 */
export async function loadMainInstanceData(params: {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): Promise<DataResponse | null> {
  try {
    const response = await QuickRunApi.getData(params);
    return response.success && !response.data.notModified ? response.data : null;
  } catch {
    return null;
  }
}

function DataTabContent({
  target,
  loadMainData,
  ...rest
}: Omit<DataTabViewProps, 'source' | 'onSourceChange' | 'mainData' | 'mainLoading'> & {
  loadMainData: () => Promise<DataResponse | null>;
}) {
  const [source, setSource] = useState<DataTabSource>('active');
  const [mainData, setMainData] = useState<DataResponse | null>(null);
  const [mainLoading, setMainLoading] = useState(false);
  const loadSeqRef = useRef(0);

  const onSourceChange = useCallback(
    (next: DataTabSource) => {
      setSource(next);
      if (next !== 'main') return;
      const seq = ++loadSeqRef.current;
      setMainLoading(true);
      void loadMainData().then((data) => {
        if (loadSeqRef.current !== seq) return;
        setMainData(data);
        setMainLoading(false);
      });
    },
    [loadMainData],
  );

  return (
    <DataTabView
      {...rest}
      target={target}
      source={source}
      onSourceChange={onSourceChange}
      mainData={mainData}
      mainLoading={mainLoading}
    />
  );
}

export interface DataTabViewProps {
  data: DataResponse | null;
  loading: boolean;
  historyNone: boolean;
  fileContext: Omit<FileHandleChipsProps, 'data'> | undefined;
  /** The instance `data` belongs to; `via` set = a sub-flow is open. */
  target: DataTarget | null;
  source: DataTabSource;
  onSourceChange: (source: DataTabSource) => void;
  /** The main instance's data, loaded on demand for `source: 'main'`. */
  mainData: DataResponse | null;
  mainLoading: boolean;
}

/**
 * The Data tab, hook-free (this package's SSR-only test harness cannot
 * drive interaction). While a sub-flow is open it names it and offers a
 * switch between its data and the main instance's.
 */
export function DataTabView({
  data,
  loading,
  historyNone,
  fileContext,
  target,
  source,
  onSourceChange,
  mainData,
  mainLoading,
}: DataTabViewProps) {
  const via = target?.via ?? null;
  const showMain = via !== null && source === 'main';
  const body = (
    <DataTabBody
      data={showMain ? mainData : data}
      loading={showMain ? mainLoading : loading}
      historyNone={historyNone}
      fileContext={fileContext}
    />
  );
  if (!via) return body;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          Active sub-flow: {via.subFlowName} · {via.subFlowInstanceId.slice(0, 8)}
        </span>
        <DataSourceSwitch source={source} onSourceChange={onSourceChange} />
      </div>
      {body}
    </div>
  );
}

const DATA_SOURCES: { id: DataTabSource; label: string }[] = [
  { id: 'active', label: 'Active flow' },
  { id: 'main', label: 'Main instance' },
];

function DataSourceSwitch({
  source,
  onSourceChange,
}: {
  source: DataTabSource;
  onSourceChange: (source: DataTabSource) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Data source"
      className="inline-flex rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-textCodeBlock-background)] p-0.5"
    >
      {DATA_SOURCES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={source === option.id}
          tabIndex={source === option.id ? 0 : -1}
          className={`rounded px-2 py-1 text-[10px] font-medium focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] ${
            source === option.id
              ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
              : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
          }`}
          onClick={() => onSourceChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DataTabBody({
  data,
  loading,
  historyNone,
  fileContext,
}: {
  data: DataResponse | null;
  loading: boolean;
  historyNone: boolean;
  fileContext: Omit<FileHandleChipsProps, 'data'> | undefined;
}) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) {
    return (
      <EmptyState
        message={
          historyNone
            ? 'No data yet — a history: none flow writes its data once, at Finish, a SubFlow handoff or a fault.'
            : 'No data available'
        }
      />
    );
  }
  // The runtime returns the instance payload under `data.data` and any
  // requested extensions under `data.extensions`. Show both so users
  // don't have to flip through DevTools to inspect extension state.
  const hasExtensions =
    data.extensions != null &&
    typeof data.extensions === 'object' &&
    Object.keys(data.extensions).length > 0;
  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto">
      <section className={`flex min-h-0 flex-col gap-1 ${hasExtensions ? '' : 'flex-1'}`}>
        <SectionLabel>Data</SectionLabel>
        {fileContext ? <FileHandleChips data={data.data} {...fileContext} /> : null}
        <CopyableJsonBlock value={data.data} fillHeight={!hasExtensions} />
      </section>
      {hasExtensions ? (
        <section className="flex flex-col gap-1">
          <SectionLabel>Extensions</SectionLabel>
          <CopyableJsonBlock value={data.extensions} />
        </section>
      ) : null}
    </div>
  );
}

export interface RawTabContentProps {
  response: StateResponse | null;
  receivedAt: number | null;
  /** The last round was a 304 — `response` is the previous full body. */
  notModified: boolean;
}

/**
 * The State Function (LongPoll) response, verbatim.
 *
 * Forge maps this payload field by field into the dashboard (state,
 * transitions, view, data href, interaction), so a developer debugging what
 * the engine *actually* sent otherwise has to open DevTools. Every round is
 * captured, including the busy ones the dashboard only reads `status`/`state`
 * from — see `setLastStateResponse`.
 *
 * Props rather than store reads: this package's test harness is SSR-only
 * (`renderToStaticMarkup`), where zustand serves the snapshot frozen at store
 * creation, so a store-reading component cannot be asserted on.
 */
export function RawTabContent({ response, receivedAt, notModified }: RawTabContentProps) {
  if (!response) return <EmptyState message="No state response yet" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>State Response</SectionLabel>
        {receivedAt != null ? (
          <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
            {new Date(receivedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
      {notModified ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          Last round returned 304 Not Modified — showing the last full body.
        </p>
      ) : null}
      {/* `responseHeaders` and `notModified` on this object are added by
          Forge (`quickrun.service.getState`); everything else is the parsed
          engine body, passed through unfiltered. */}
      <CopyableJsonBlock value={response} fillHeight />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
      {children}
    </span>
  );
}



function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-[var(--vscode-descriptionForeground)]">
      <span className="animate-pulse">Loading...</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-[var(--vscode-descriptionForeground)]">
      {message}
    </div>
  );
}
