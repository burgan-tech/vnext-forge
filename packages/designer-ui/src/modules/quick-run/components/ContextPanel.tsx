import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { extractEtag } from '../etagFromResponse';
import { quickRunHeadersFromState } from '../pseudo-ui/mergeQuickRunHeaders';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { transitionDisplayLabel } from '../utils/displayLabels';
import { useRuntimeSupports } from '../utils/runtimeFeatures';
import {
  type ContextPanelTab,
  type OpenSubFlowTarget,
  type StateResponse,
} from '../types/quickrun.types';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { CorrelationsTabContent } from './CorrelationsTab';
import { type ElementMetricsLoader } from './ElementMetrics';
import { HistoryTabContent } from './HistoryTab';
import { TasksTabContent } from './TasksTab';

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
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const toolWideHeaders = useQuickRunStore((s) => s.toolWideHeaders);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const activeState = useQuickRunStore((s) => s.activeState);
  const activeStateLoading = useQuickRunStore((s) => s.activeStateLoading);
  const pollingInstanceId = useQuickRunStore((s) => s.pollingInstanceId);

  const activeData = useQuickRunStore((s) => s.activeData);
  const activeDataLoading = useQuickRunStore((s) => s.activeDataLoading);
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
    try {
      const ifNoneMatch = useQuickRunStore.getState().etags.data;
      const response = await QuickRunApi.getData({ domain, workflowKey, instanceId: activeTabId, ifNoneMatch, headers: globalHeaders, runtimeUrl: environmentUrl });
      if (response.success) {
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
      useQuickRunStore.getState().setEtag('data', undefined);
      setActiveData(null);
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
      <div className="flex border-b border-[var(--vscode-panel-border)]" role="tablist" aria-label="Context details">
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
                ? 'border-b-2 border-b-[var(--vscode-focusBorder)] text-[var(--vscode-foreground)]'
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
          <DataTabContent data={activeData} loading={activeDataLoading} />
        )}
        {contextPanelTab === 'history' && (
          <HistoryTabContent
            key={activeTabId ?? 'none'}
            history={activeHistory}
            loading={activeHistoryLoading}
            {...(loadElementMetrics ? { loadMetrics: loadElementMetrics } : {})}
            tasks={activeTaskHistory}
            transitionLabel={transitionLabel}
          />
        )}
        {contextPanelTab === 'tasks' && (
          <TasksTabContent
            items={activeTaskHistory}
            loading={activeTaskHistoryLoading}
            error={activeTaskHistoryError}
            transitionLabel={transitionLabel}
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

function DataTabContent({ data, loading }: { data: ReturnType<typeof useQuickRunStore.getState>['activeData']; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) return <EmptyState message="No data available" />;
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
