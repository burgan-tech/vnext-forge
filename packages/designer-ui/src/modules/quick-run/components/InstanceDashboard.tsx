import { useCallback, useState } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunPolling } from '../hooks/useQuickRunPolling';
import { useQuickRunStore } from '../store/quickRunStore';
import type { TransitionInfo } from '../types/quickrun.types';
import { safeViewContent } from '../types/quickrun.types';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { EnvBadge } from './EnvBadge';
import { ProgressStepper } from './ProgressStepper';
import { StatusBadge } from './StatusBadge';

export function InstanceDashboard() {
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const instances = useQuickRunStore((s) => s.instances);
  const activeState = useQuickRunStore((s) => s.activeState);
  const activeStateLoading = useQuickRunStore((s) => s.activeStateLoading);
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const setContextPanelTab = useQuickRunStore((s) => s.setContextPanelTab);
  const openTransitionDialog = useQuickRunStore((s) => s.openTransitionDialog);
  const flowLabels = useQuickRunStore((s) => s.flowLabels);

  const stateView = useQuickRunStore((s) => s.stateView);
  const stateViewLoading = useQuickRunStore((s) => s.stateViewLoading);
  const stateViewError = useQuickRunStore((s) => s.stateViewError);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);

  const { pollState } = useQuickRunPolling(pollingConfig);

  const [retryHeadersOpen, setRetryHeadersOpen] = useState(false);
  const [retryHeaders, setRetryHeaders] = useState<{ name: string; value: string }[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);

  const activeInstance = activeTabId ? instances.get(activeTabId) : undefined;

  const handleTransitionClick = (transition: TransitionInfo) => {
    openTransitionDialog(transition);
  };

  const openRetryPanel = useCallback(() => {
    const inherited = { ...globalHeaders, ...sessionHeaders };
    setRetryHeaders(Object.entries(inherited).map(([name, value]) => ({ name, value })));
    setRetryHeadersOpen(true);
  }, [globalHeaders, sessionHeaders]);

  const handleRetry = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setRetrying(true);
    const merged: Record<string, string> = {};
    for (const h of retryHeaders) {
      if (h.name.trim()) merged[h.name.trim()] = h.value;
    }
    await pollState({ domain, workflowKey, instanceId: activeTabId, headers: merged });
    setRetrying(false);
    setRetryHeadersOpen(false);
  }, [activeTabId, domain, workflowKey, retryHeaders, pollState]);

  const handleCancelConfirmed = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    setCancelling(true);
    try {
      const merged = { ...globalHeaders, ...sessionHeaders };
      await QuickRunApi.fireTransition({
        domain,
        workflowKey,
        instanceId: activeTabId,
        transitionKey: 'cancel',
        sync: true,
        headers: merged,
      });
      await pollState({ domain, workflowKey, instanceId: activeTabId, headers: merged });
    } finally {
      setCancelling(false);
      setCancelConfirmOpen(false);
    }
  }, [activeTabId, domain, workflowKey, globalHeaders, sessionHeaders, pollState]);

  const handleRetryInstanceSubmit = useCallback(async (params: {
    headers: Record<string, string>;
    attributes?: Record<string, unknown>;
    key?: string;
    tags?: string[];
  }) => {
    if (!activeTabId || !domain || !workflowKey) return;
    await QuickRunApi.retryInstance({
      domain,
      workflowKey,
      instanceId: activeTabId,
      headers: params.headers,
      attributes: params.attributes,
      key: params.key,
      tags: params.tags,
    });
    await pollState({ domain, workflowKey, instanceId: activeTabId, headers: params.headers });
    setRetryDialogOpen(false);
  }, [activeTabId, domain, workflowKey, pollState]);

  if (!activeInstance) {
    return (
      <main className="flex h-full flex-1 items-center justify-center text-[var(--vscode-descriptionForeground)]">
        <div className="text-center">
          <p className="text-sm">Select an instance or start a new run</p>
          <p className="mt-1 text-xs">Use + New Run to begin</p>
        </div>
      </main>
    );
  }

  const transitions = activeState?.transitions ?? activeInstance.transitions ?? [];
  const sharedTransitions = activeState?.sharedTransitions ?? activeInstance.sharedTransitions ?? [];
  const totalSteps = transitions.length + 1;
  const currentStep = 1;

  const isActive = activeInstance.status === 'A' || activeInstance.status === 'B';

  return (
    <main className="flex h-full flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{flowLabels?.workflowLabel ?? workflowKey}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--vscode-descriptionForeground)]">
            {environmentName && (
              <span className="flex items-center gap-1">
                ENV <EnvBadge name={environmentName} />
              </span>
            )}
            <span className="flex items-center gap-1">
              INSTANCE{' '}
              <code className="text-[var(--vscode-textLink-foreground)]">{activeInstance.id.slice(0, 8)}…</code>
              <button
                className="inline-flex items-center rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                title={idCopied ? 'Copied!' : `Copy full ID: ${activeInstance.id}`}
                onClick={() => {
                  void navigator.clipboard.writeText(activeInstance.id).then(() => {
                    setIdCopied(true);
                    setTimeout(() => setIdCopied(false), 1500);
                  });
                }}
              >
                {idCopied ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6.27 10.87h.01l4.49-4.49-1.06-1.06-3.44 3.44-1.44-1.44-1.06 1.06 2.5 2.49z"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4v-1.5A1.5 1.5 0 015.5 1h5A1.5 1.5 0 0112 2.5v7A1.5 1.5 0 0110.5 11H9v1.5A1.5 1.5 0 017.5 14h-5A1.5 1.5 0 011 12.5v-7A1.5 1.5 0 012.5 4H4zm1 0h2.5A1.5 1.5 0 019 5.5V10h1.5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5V4zm-2.5 1a.5.5 0 00-.5.5v7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5z"/></svg>
                )}
              </button>
            </span>
            <span>STARTED {new Date(activeInstance.startedAt).toLocaleTimeString()}</span>
          </div>
        </div>
        <StatusBadge status={activeInstance.status} />
      </div>

      {/* Progress */}
      <section>
        <ProgressStepper
          currentStep={currentStep}
          totalSteps={Math.max(totalSteps, 3)}
          currentStateName={(() => {
            const rawState = activeState?.state ?? activeInstance.currentState;
            if (!rawState) return undefined;
            return flowLabels?.states[rawState] ?? rawState;
          })()}
        />
      </section>

      {/* Status */}
      <section className="rounded border border-[var(--vscode-panel-border)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">STATUS</p>
            <StatusBadge status={activeInstance.status} />
          </div>
          <div className="flex items-center gap-2">
            {activeStateLoading && (
              <span className="text-xs text-[var(--vscode-descriptionForeground)] animate-pulse">
                Polling...
              </span>
            )}
            {!activeStateLoading && isActive && (
              <button
                className="flex items-center gap-1 rounded border border-[var(--vscode-errorForeground)] px-2 py-1 text-[10px] text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-inputValidation-errorBackground)] disabled:opacity-50"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={cancelling}
                title="Cancel this instance"
              >
                ✕ {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
            {!activeStateLoading && activeInstance.status === 'F' && (
              <button
                className="flex items-center gap-1 rounded border border-[var(--vscode-charts-orange)] px-2 py-1 text-[10px] text-[var(--vscode-charts-orange)] hover:bg-[var(--vscode-inputValidation-warningBackground)]"
                onClick={() => setRetryDialogOpen(true)}
                title="Retry this faulted instance"
              >
                <RetryIcon />
                Retry Instance
              </button>
            )}
            {!activeStateLoading && (
              <button
                className="flex items-center gap-1 rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
                onClick={retryHeadersOpen ? handleRetry : openRetryPanel}
                disabled={retrying}
                title="Retry state function with custom headers"
              >
                <RetryIcon />
                {retrying ? 'Retrying...' : 'Retry State'}
              </button>
            )}
          </div>
        </div>

        {retryHeadersOpen && !activeStateLoading && (
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--vscode-panel-border)] pt-3">
            <p className="text-[10px] font-medium text-[var(--vscode-descriptionForeground)]">
              Edit headers before retrying
            </p>
            {retryHeaders.map((h, i) => (
              <div key={i} className="flex gap-1">
                <input
                  type="text"
                  value={h.name}
                  onChange={(e) => {
                    const next = [...retryHeaders];
                    next[i] = { ...next[i], name: e.target.value };
                    setRetryHeaders(next);
                  }}
                  placeholder="Header name"
                  className="w-28 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => {
                    const next = [...retryHeaders];
                    next[i] = { ...next[i], value: e.target.value };
                    setRetryHeaders(next);
                  }}
                  placeholder="Value"
                  className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
                <button
                  className="text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-foreground)]"
                  onClick={() => setRetryHeaders(retryHeaders.filter((_, j) => j !== i))}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
                onClick={() => setRetryHeaders([...retryHeaders, { name: '', value: '' }])}
              >
                + Add header
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                  onClick={() => setRetryHeadersOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded bg-[var(--vscode-button-background)] px-2 py-1 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Response Headers */}
      {activeState?.responseHeaders && Object.keys(activeState.responseHeaders).length > 0 && (
        <ResponseHeadersSection headers={activeState.responseHeaders} />
      )}

      {/* Transition Buttons — placed above State View */}
      {transitions.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
            Available Transitions
          </p>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <button
                key={t.name}
                className="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
                onClick={() => handleTransitionClick(t)}
                disabled={activeStateLoading}
              >
                ▶ {flowLabels?.transitions[t.name] ?? t.name}
              </button>
            ))}
          </div>
          {sharedTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sharedTransitions.map((t) => (
                <button
                  key={t.name}
                  className="rounded border border-[var(--vscode-button-secondaryBackground)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                  onClick={() => handleTransitionClick(t)}
                  disabled={activeStateLoading}
                >
                  ↺ {flowLabels?.transitions[t.name] ?? t.name}
                  <span className="ml-1.5 rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]">
                    shared
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Actions (View Data / History / View tabs) — placed above State View */}
      <section className="flex gap-2 border-t border-[var(--vscode-panel-border)] pt-3">
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => setContextPanelTab('data')}
        >
          View Data
        </button>
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => setContextPanelTab('history')}
        >
          History
        </button>
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => setContextPanelTab('view')}
        >
          View
        </button>
      </section>

      {/* State View (auto-loaded page-level view) — collapsible, placed last */}
      <StateViewSection
        view={stateView}
        loading={stateViewLoading}
        error={stateViewError}
        hasView={activeState?.view?.hasView}
      />

      {cancelConfirmOpen && (
        <CancelConfirmDialog
          cancelling={cancelling}
          onConfirm={handleCancelConfirmed}
          onClose={() => setCancelConfirmOpen(false)}
        />
      )}

      {retryDialogOpen && (
        <RetryInstanceDialog
          globalHeaders={globalHeaders}
          sessionHeaders={sessionHeaders}
          onSubmit={handleRetryInstanceSubmit}
          onClose={() => setRetryDialogOpen(false)}
        />
      )}
    </main>
  );
}

function CancelConfirmDialog({
  cancelling,
  onConfirm,
  onClose,
}: {
  cancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="flex w-[360px] flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg">
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Cancel Instance</h2>
          <button className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]" onClick={onClose}>✕</button>
        </header>
        <div className="px-4 py-4">
          <p className="text-xs text-[var(--vscode-foreground)]">
            Are you sure you want to cancel this instance? This action cannot be undone.
          </p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={onClose}
            disabled={cancelling}
          >
            No, keep it
          </button>
          <button
            className="rounded bg-[var(--vscode-errorForeground)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            onClick={onConfirm}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Yes, cancel instance'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function RetryInstanceDialog({
  globalHeaders,
  sessionHeaders,
  onSubmit,
  onClose,
}: {
  globalHeaders: Record<string, string>;
  sessionHeaders: Record<string, string>;
  onSubmit: (params: {
    headers: Record<string, string>;
    attributes?: Record<string, unknown>;
    key?: string;
    tags?: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const inherited = { ...globalHeaders, ...sessionHeaders };
  const [headers, setHeaders] = useState<{ name: string; value: string }[]>(
    Object.entries(inherited).map(([name, value]) => ({ name, value })),
  );
  const [attributes, setAttributes] = useState('{}');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const merged: Record<string, string> = {};
      for (const h of headers) {
        if (h.name.trim()) merged[h.name.trim()] = h.value;
      }
      let parsedAttrs: Record<string, unknown> | undefined;
      try {
        const parsed = JSON.parse(attributes);
        if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
          parsedAttrs = parsed;
        }
      } catch { /* ignore parse error for empty/invalid */ }
      await onSubmit({ headers: merged, attributes: parsedAttrs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="flex w-[480px] max-h-[80vh] flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg">
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Retry Faulted Instance</h2>
          <button className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]" onClick={onClose}>✕</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            {/* Headers */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
                Headers
              </label>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    type="text"
                    value={h.name}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i] = { ...next[i], name: e.target.value };
                      setHeaders(next);
                    }}
                    placeholder="Header name"
                    className="w-32 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[11px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i] = { ...next[i], value: e.target.value };
                      setHeaders(next);
                    }}
                    placeholder="Value"
                    className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[11px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                  />
                  <button
                    className="text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-foreground)]"
                    onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="self-start text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
                onClick={() => setHeaders([...headers, { name: '', value: '' }])}
              >
                + Add header
              </button>
            </div>

            {/* Attributes (JSON) */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
                Attributes (JSON)
              </label>
              <textarea
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 font-mono text-[11px] text-[var(--vscode-input-foreground)]"
                rows={4}
                value={attributes}
                onChange={(e) => setAttributes(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-2 py-1.5 text-[11px] text-[var(--vscode-errorForeground)]">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-[var(--vscode-charts-orange)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Retrying...' : 'Retry Instance'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function RetryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.543.53 1.186.53 1.874a3.754 3.754 0 01-3.753 3.753 3.754 3.754 0 01-3.753-3.753 3.754 3.754 0 013.753-3.753c.466 0 .911.085 1.321.24V2.706A4.994 4.994 0 008.505 2.5a5.006 5.006 0 00-5.005 5.005 5.006 5.006 0 005.005 5.005 5.006 5.006 0 005.005-5.005c0-.672-.134-1.313-.375-1.896z" />
      <path d="M8.505 3.197v3.308l2.21-1.654-2.21-1.654z" />
    </svg>
  );
}

function StateViewSection({
  view,
  loading,
  error,
  hasView,
}: {
  view: ReturnType<typeof useQuickRunStore.getState>['stateView'];
  loading: boolean;
  error: boolean;
  hasView?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!hasView && !loading && !view) return null;

  return (
    <section className="rounded border border-[var(--vscode-panel-border)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-controls="state-view-body"
      >
        <p className="text-xs font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
          State View
        </p>
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div id="state-view-body" className="border-t border-[var(--vscode-panel-border)] p-3">
          {loading && (
            <div className="flex items-center justify-center py-4 text-xs text-[var(--vscode-descriptionForeground)]">
              <span className="animate-pulse">Loading view...</span>
            </div>
          )}
          {!loading && error && (
            <div className="py-2 text-xs text-[var(--vscode-descriptionForeground)]">
              No view defined for this state
            </div>
          )}
          {!loading && !error && view && (
            <StateViewContent view={view} />
          )}
        </div>
      )}
    </section>
  );
}

const PROMINENT_HEADERS = ['x-trace-id', 'x-span-id', 'x-request-id', 'traceparent', 'x-app-version', 'server', 'etag'] as const;

function ResponseHeadersSection({ headers }: { headers: Record<string, string> }) {
  const [collapsed, setCollapsed] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const traceId = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === 'x-trace-id',
  );

  const prominentEntries = Object.entries(headers).filter(
    ([k]) => PROMINENT_HEADERS.includes(k.toLowerCase() as typeof PROMINENT_HEADERS[number]) && k.toLowerCase() !== 'x-trace-id',
  );
  const otherEntries = Object.entries(headers).filter(
    ([k]) => !PROMINENT_HEADERS.includes(k.toLowerCase() as typeof PROMINENT_HEADERS[number]) && k.toLowerCase() !== 'x-trace-id',
  );

  const copyValue = (key: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  return (
    <section className="rounded border border-[var(--vscode-panel-border)] p-3">
      {traceId && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-[var(--vscode-descriptionForeground)]">X-Trace-Id</span>
          <code className="text-[var(--vscode-textLink-foreground)]">{traceId[1]}</code>
          <button
            className="inline-flex rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            onClick={() => copyValue(traceId[0], traceId[1])}
            title={copiedKey === traceId[0] ? 'Copied!' : 'Copy'}
          >
            {copiedKey === traceId[0] ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6.27 10.87h.01l4.49-4.49-1.06-1.06-3.44 3.44-1.44-1.44-1.06 1.06 2.5 2.49z"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4v-1.5A1.5 1.5 0 015.5 1h5A1.5 1.5 0 0112 2.5v7A1.5 1.5 0 0110.5 11H9v1.5A1.5 1.5 0 017.5 14h-5A1.5 1.5 0 011 12.5v-7A1.5 1.5 0 012.5 4H4zm1 0h2.5A1.5 1.5 0 019 5.5V10h1.5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5V4zm-2.5 1a.5.5 0 00-.5.5v7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-5z"/></svg>
            )}
          </button>
        </div>
      )}

      {(prominentEntries.length > 0 || otherEntries.length > 0) && (
        <div className="mt-1">
          <button
            className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? `Show ${prominentEntries.length + otherEntries.length} more headers ▸` : 'Hide headers ▾'}
          </button>
          {!collapsed && (
            <div className="mt-2 flex flex-col gap-1">
              {prominentEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[10px]">
                  <span className="w-32 shrink-0 font-medium text-[var(--vscode-descriptionForeground)]">{k}</span>
                  <span className="truncate text-[var(--vscode-foreground)]">{v}</span>
                  <button
                    className="shrink-0 rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                    onClick={() => copyValue(k, v)}
                    title={copiedKey === k ? 'Copied!' : 'Copy'}
                  >
                    {copiedKey === k ? '✓' : '⧉'}
                  </button>
                </div>
              ))}
              {otherEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
                  <span className="w-32 shrink-0">{k}</span>
                  <span className="truncate">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StateViewContent({ view }: { view: NonNullable<ReturnType<typeof useQuickRunStore.getState>['stateView']> }) {
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
        {view.label && (
          <span className="text-[var(--vscode-descriptionForeground)]">{view.label}</span>
        )}
      </div>
      {jsonValue != null ? (
        <CopyableJsonBlock value={jsonValue} />
      ) : (
        <CopyableJsonBlock value={displayContent || '(empty)'} />
      )}
    </div>
  );
}
