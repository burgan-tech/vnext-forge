import { useCallback, useEffect, useRef, useState } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import type { ContextPanelTab, CorrelationInfo, HistoryTransition } from '../types/quickrun.types';
import { safeViewContent } from '../types/quickrun.types';
import { CopyableJsonBlock } from './CopyableJsonBlock';

const TABS: { id: ContextPanelTab; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'data', label: 'Data' },
  { id: 'history', label: 'History' },
  { id: 'correlations', label: 'Correlations' },
];

export function ContextPanel() {
  const contextPanelTab = useQuickRunStore((s) => s.contextPanelTab);
  const setContextPanelTab = useQuickRunStore((s) => s.setContextPanelTab);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);

  const activeView = useQuickRunStore((s) => s.activeView);
  const activeViewLoading = useQuickRunStore((s) => s.activeViewLoading);
  const setActiveView = useQuickRunStore((s) => s.setActiveView);
  const setActiveViewLoading = useQuickRunStore((s) => s.setActiveViewLoading);

  const activeData = useQuickRunStore((s) => s.activeData);
  const activeDataLoading = useQuickRunStore((s) => s.activeDataLoading);
  const setActiveData = useQuickRunStore((s) => s.setActiveData);
  const setActiveDataLoading = useQuickRunStore((s) => s.setActiveDataLoading);

  const activeHistory = useQuickRunStore((s) => s.activeHistory);
  const activeHistoryLoading = useQuickRunStore((s) => s.activeHistoryLoading);
  const setActiveHistory = useQuickRunStore((s) => s.setActiveHistory);
  const setActiveHistoryLoading = useQuickRunStore((s) => s.setActiveHistoryLoading);

  const [viewNotFound, setViewNotFound] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setActiveDataLoading(true);
    try {
      const response = await QuickRunApi.getData({ domain, workflowKey, instanceId: activeTabId, headers: globalHeaders });
      if (response.success) {
        setActiveData(response.data);
      } else {
        setActiveData(null);
      }
    } catch {
      setActiveData(null);
    }
    setActiveDataLoading(false);
  }, [activeTabId, domain, workflowKey, globalHeaders, setActiveData, setActiveDataLoading]);

  const loadView = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setActiveViewLoading(true);
    setViewNotFound(false);
    try {
      const response = await QuickRunApi.getView({ domain, workflowKey, instanceId: activeTabId, headers: globalHeaders });
      if (response.success) {
        setActiveView(response.data);
      } else {
        setActiveView(null);
        setViewNotFound(true);
      }
    } catch {
      setActiveView(null);
      setViewNotFound(true);
    }
    setActiveViewLoading(false);
  }, [activeTabId, domain, workflowKey, globalHeaders, setActiveView, setActiveViewLoading]);

  const loadHistory = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setActiveHistoryLoading(true);
    try {
      const response = await QuickRunApi.getHistory({ domain, workflowKey, instanceId: activeTabId, headers: globalHeaders });
      if (response.success) {
        setActiveHistory(response.data);
      } else {
        setActiveHistory(null);
      }
    } catch {
      setActiveHistory(null);
    }
    setActiveHistoryLoading(false);
  }, [activeTabId, domain, workflowKey, globalHeaders, setActiveHistory, setActiveHistoryLoading]);

  useEffect(() => {
    if (!activeTabId) return;
    switch (contextPanelTab) {
      case 'data': loadData(); break;
      case 'view': loadView(); break;
      case 'history': loadHistory(); break;
    }
  }, [contextPanelTab, activeTabId, loadData, loadView, loadHistory]);

  if (!activeTabId) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-[var(--vscode-editor-background)] text-xs text-[var(--vscode-descriptionForeground)]">
        No instance selected
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--vscode-editor-background)]">
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
        className="flex-1 overflow-y-auto p-3"
        role="tabpanel"
        id={`quickrun-tabpanel-${contextPanelTab}`}
        aria-labelledby={`quickrun-tab-${contextPanelTab}`}
      >
        {contextPanelTab === 'view' && (
          <ViewTabContent view={activeView} loading={activeViewLoading} notFound={viewNotFound} />
        )}
        {contextPanelTab === 'data' && (
          <DataTabContent data={activeData} loading={activeDataLoading} />
        )}
        {contextPanelTab === 'history' && (
          <HistoryTabContent history={activeHistory} loading={activeHistoryLoading} />
        )}
        {contextPanelTab === 'correlations' && (
          <CorrelationsTabContent />
        )}
      </div>
    </aside>
  );
}

function ViewTabContent({ view, loading, notFound }: { view: ReturnType<typeof useQuickRunStore.getState>['activeView']; loading: boolean; notFound: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (notFound) return <EmptyState message="No view defined for this state" />;
  if (!view) return <EmptyState message="No view available" />;
  const displayContent = safeViewContent(view.content);

  let jsonValue: unknown = null;
  try { jsonValue = JSON.parse(displayContent); } catch { /* not JSON */ }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">{view.key}</span>
        <span className="rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]">
          {view.type}
        </span>
      </div>
      {jsonValue != null ? (
        <CopyableJsonBlock value={jsonValue} />
      ) : (
        <CopyableJsonBlock value={displayContent || '(empty)'} />
      )}
    </div>
  );
}

function DataTabContent({ data, loading }: { data: ReturnType<typeof useQuickRunStore.getState>['activeData']; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) return <EmptyState message="No data available" />;
  return <CopyableJsonBlock value={data.data} />;
}


const TRIGGER_TYPE_STYLES: Record<string, string> = {
  Manual:    'bg-[var(--vscode-charts-blue)] text-white',
  Timer:     'bg-[var(--vscode-charts-orange)] text-white',
  Signal:    'bg-[var(--vscode-charts-purple)] text-white',
  Auto:      'bg-[var(--vscode-charts-green)] text-white',
  Error:     'bg-[var(--vscode-errorForeground)] text-white',
  SubFlow:   'bg-[var(--vscode-charts-yellow)] text-black',
};

function TriggerTypeBadge({ triggerType }: { triggerType: string }) {
  const style = TRIGGER_TYPE_STYLES[triggerType] ?? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${style}`}>
      {triggerType}
    </span>
  );
}

function HistoryTabContent({ history, loading }: { history: ReturnType<typeof useQuickRunStore.getState>['activeHistory']; loading: boolean }) {
  const [detailItem, setDetailItem] = useState<HistoryTransition | null>(null);

  if (loading) return <LoadingPlaceholder />;
  if (!history || history.transitions.length === 0) return <EmptyState message="No transition history yet" />;
  return (
    <>
      <div className="flex flex-col gap-1">
        {history.transitions.map((t) => (
          <div
            key={t.id}
            className="rounded border border-[var(--vscode-panel-border)] p-2 text-[11px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.transitionId}</span>
              <div className="flex items-center gap-1">
                <span className="text-[var(--vscode-descriptionForeground)]">
                  {t.durationSeconds != null ? `${t.durationSeconds.toFixed(2)}s` : ''}
                </span>
                <button
                  className="flex h-4 w-4 items-center justify-center rounded text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
                  onClick={() => setDetailItem(t)}
                  aria-label={`View details for ${t.transitionId}`}
                  title="View details"
                >
                  ⓘ
                </button>
              </div>
            </div>
            <div className="mt-0.5 text-[var(--vscode-descriptionForeground)]">
              {t.fromState} → {t.toState}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              <TriggerTypeBadge triggerType={t.triggerType} />
              <span className="text-[var(--vscode-descriptionForeground)]">
                {new Date(t.startedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      {detailItem && (
        <TransitionDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </>
  );
}

function TransitionDetailModal({ item, onClose }: { item: HistoryTransition; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-detail-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex w-[500px] max-h-[80vh] flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 id="transition-detail-title" className="text-sm font-semibold">
            Transition Detail
          </h2>
          <button
            className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 text-[11px]">
          <div className="flex flex-col gap-3">
            <DetailRow label="Transition" value={item.transitionId} />
            <DetailRow label="From → To" value={`${item.fromState} → ${item.toState}`} />
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 font-semibold text-[var(--vscode-descriptionForeground)]">Trigger</span>
              <TriggerTypeBadge triggerType={item.triggerType} />
            </div>
            {item.durationSeconds != null && (
              <DetailRow label="Duration" value={`${item.durationSeconds.toFixed(2)}s`} />
            )}
            <DetailRow label="Started" value={new Date(item.startedAt).toLocaleString()} />
            {item.finishedAt && (
              <DetailRow label="Finished" value={new Date(item.finishedAt).toLocaleString()} />
            )}
            <DetailRow label="Created" value={new Date(item.createdAt).toLocaleString()} />
            {item.createdBy && <DetailRow label="Created By" value={item.createdBy} />}
            {item.createdByBehalfOf && <DetailRow label="On Behalf Of" value={item.createdByBehalfOf} />}

            {item.body && Object.keys(item.body).length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--vscode-descriptionForeground)]">Request Body</span>
                <CopyableJsonBlock value={item.body} />
              </div>
            )}

            {item.header && Object.keys(item.header).length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--vscode-descriptionForeground)]">Request Headers</span>
                <CopyableJsonBlock value={item.header} />
              </div>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 font-semibold text-[var(--vscode-descriptionForeground)]">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function CorrelationsTabContent() {
  const activeState = useQuickRunStore((s) => s.activeState);
  const correlations: CorrelationInfo[] = activeState?.activeCorrelations ?? [];

  if (correlations.length === 0) {
    return <EmptyState message="No active correlations" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {correlations.map((c) => (
        <div
          key={c.correlationId}
          className="rounded border border-[var(--vscode-panel-border)] p-2 text-[11px]"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{c.subFlowName}</span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
              c.isCompleted
                ? 'bg-[var(--vscode-charts-green)] text-white'
                : 'bg-[var(--vscode-charts-blue)] text-white'
            }`}>
              {c.isCompleted ? 'Completed' : 'Active'}
            </span>
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
            <span>Domain: {c.subFlowDomain}</span>
            <span>Type: {c.subFlowType} v{c.subFlowVersion}</span>
            <span>Parent State: {c.parentState}</span>
            <span className="truncate" title={c.subFlowInstanceId}>
              Instance: {c.subFlowInstanceId.slice(0, 12)}…
            </span>
            <span className="truncate" title={c.correlationId}>
              Correlation: {c.correlationId.slice(0, 12)}…
            </span>
          </div>
        </div>
      ))}
    </div>
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
