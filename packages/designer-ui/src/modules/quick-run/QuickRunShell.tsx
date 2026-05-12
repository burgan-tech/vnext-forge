import { useCallback, useEffect, useRef, useState } from 'react';

import { callApi } from '../../api/client';
import * as QuickRunApi from './QuickRunApi';
import type { SchemaReference, WorkflowBucketConfig } from './QuickRunApi';
import { ContextPanel } from './components/ContextPanel';
import { HeadersConfigDialog } from './components/HeadersConfigDialog';
import { InstanceDashboard } from './components/InstanceDashboard';
import { InstanceListPanel } from './components/InstanceListPanel';
import { NewRunDialog } from './components/NewRunDialog';
import { QuickRunStatusBar } from './components/QuickRunStatusBar';
import { QuickRunTabBar } from './components/QuickRunTabBar';
import { ResizableHandle } from './components/ResizableHandle';
import { TransitionDialog } from './components/TransitionDialog';
import { useQuickRunPolling } from './hooks/useQuickRunPolling';
import { useQuickRunStore } from './store/quickRunStore';
import { extractLabelsMap } from './utils/extractLabelsMap';

interface HealthMessage {
  type: 'quickrun:health';
  status: 'healthy' | 'unhealthy' | 'unknown';
  runtimeDomain?: string;
}

interface QuickRunShellProps {
  domain: string;
  workflowKey: string;
  environmentName?: string;
  environmentUrl?: string;
  projectPath?: string;
  /**
   * Project id — supplied by the host shell. NewRunDialog needs it for the
   * test-data + presets backend calls. When absent those features are
   * disabled and the dialog falls back to manual JSON entry.
   */
  projectId?: string;
  /**
   * Workflow's `attributes.startTransition.schema` reference. NewRunDialog
   * uses this to auto-fill / regenerate the payload via the
   * `test-data/generateForSchemaReference` method. Optional — workflows
   * without an attached start schema simply don't get auto-fill.
   */
  startSchemaRef?: SchemaReference;
  pollingRetryCount?: number;
  pollingIntervalMs?: number;
}

export function QuickRunShell({
  domain,
  workflowKey,
  environmentName,
  environmentUrl,
  projectPath,
  projectId,
  startSchemaRef,
  pollingRetryCount,
  pollingIntervalMs,
}: QuickRunShellProps) {
  const setWorkflowContext = useQuickRunStore((s) => s.setWorkflowContext);
  const setGlobalHeaders = useQuickRunStore((s) => s.setGlobalHeaders);
  const setRuntimeHealth = useQuickRunStore((s) => s.setRuntimeHealth);
  const setFlowLabels = useQuickRunStore((s) => s.setFlowLabels);
  const setPollingConfig = useQuickRunStore((s) => s.setPollingConfig);
  const flowLabels = useQuickRunStore((s) => s.flowLabels);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [savedHeaders, setSavedHeaders] = useState<{ name: string; value: string; isSecret?: boolean }[]>([]);
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(320);
  const configRef = useRef<WorkflowBucketConfig>(QuickRunApi.createEmptyConfig(workflowKey));

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(160, Math.min(400, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(200, Math.min(500, w + delta)));
  }, []);

  useEffect(() => {
    setWorkflowContext(domain, workflowKey, environmentName, environmentUrl);
  }, [domain, workflowKey, environmentName, environmentUrl, setWorkflowContext]);

  useEffect(() => {
    if (pollingRetryCount != null || pollingIntervalMs != null) {
      setPollingConfig({
        retryCount: pollingRetryCount ?? 12,
        intervalMs: pollingIntervalMs ?? 500,
      });
    }
  }, [pollingRetryCount, pollingIntervalMs, setPollingConfig]);

  useEffect(() => {
    if (!domain || !workflowKey) return;
    void QuickRunApi.loadWorkflowConfig(domain, workflowKey).then((loaded) => {
      const cfg = loaded ?? QuickRunApi.createEmptyConfig(workflowKey);
      configRef.current = cfg;
      if (cfg.globalHeaders && Object.keys(cfg.globalHeaders).length > 0) {
        const entries = Object.entries(cfg.globalHeaders).map(([name, value]) => ({ name, value }));
        setSavedHeaders(entries);
        setGlobalHeaders(cfg.globalHeaders);
      }
    });
  }, [domain, workflowKey, setGlobalHeaders]);

  useEffect(() => {
    if (!projectPath) return;
    void callApi<{ content: string }>({ method: 'files/read', params: { path: projectPath } }).then((res) => {
      if (!res.success) return;
      try {
        const flowJson = JSON.parse(res.data.content);
        setFlowLabels(extractLabelsMap(flowJson));
      } catch { /* malformed JSON — ignore */ }
    });
  }, [projectPath, setFlowLabels]);

  const persistConfig = useCallback((cfg: WorkflowBucketConfig) => {
    configRef.current = cfg;
    void QuickRunApi.saveWorkflowConfig(domain, workflowKey, cfg);
  }, [domain, workflowKey]);

  const setRuntimeDomain = useQuickRunStore((s) => s.setRuntimeDomain);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as HealthMessage | undefined;
      if (msg?.type === 'quickrun:health') {
        setRuntimeHealth(msg.status);
        if (msg.runtimeDomain) {
          setRuntimeDomain(msg.runtimeDomain);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setRuntimeHealth, setRuntimeDomain]);

  // --- Re-fetch state when active tab changes to a different instance ---
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const instances = useQuickRunStore((s) => s.instances);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);
  const { fetchInstanceState } = useQuickRunPolling(pollingConfig);
  const prevActiveTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTabId || activeTabId === prevActiveTabRef.current) {
      prevActiveTabRef.current = activeTabId;
      return;
    }
    prevActiveTabRef.current = activeTabId;

    const instance = instances.get(activeTabId);
    if (!instance) return;

    void fetchInstanceState({
      domain: instance.domain,
      workflowKey: instance.workflowKey,
      instanceId: instance.id,
      headers: globalHeaders,
      runtimeUrl: environmentUrl,
    });
  }, [activeTabId, instances, globalHeaders, environmentUrl, fetchInstanceState]);

  return (
    <div className="flex h-screen flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]" role="application" aria-label="Quick Run — workflow manager">
      {/* Skip link */}
      <a href="#quickrun-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--vscode-button-background)] focus:px-3 focus:py-1 focus:text-[var(--vscode-button-foreground)]">
        Skip to main content
      </a>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-3 py-1.5" role="toolbar" aria-label="QuickRun actions">
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-[var(--vscode-button-background)] px-2.5 py-1 text-[11px] font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            onClick={() => setShowNewRun(true)}
          >
            + New Run
          </button>
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={() => setShowHeaders(true)}
          >
            Headers
          </button>
        </div>
        <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">
          {domain}/{flowLabels?.workflowLabel ?? workflowKey}
        </span>
      </div>

      <QuickRunTabBar />
      <div id="quickrun-main" className="flex flex-1 min-h-0">
        <div style={{ width: leftWidth, minWidth: 160, maxWidth: 400 }} className="flex-shrink-0">
          <InstanceListPanel />
        </div>
        <ResizableHandle onResize={handleLeftResize} direction="right" />
        <div className="flex-1 min-w-0">
          <InstanceDashboard configRef={configRef} persistConfig={persistConfig} />
        </div>
        <ResizableHandle onResize={handleRightResize} direction="left" />
        <div style={{ width: rightWidth, minWidth: 200, maxWidth: 500 }} className="flex-shrink-0">
          <ContextPanel />
        </div>
      </div>
      <QuickRunStatusBar />

      <NewRunDialog
        open={showNewRun}
        onClose={() => setShowNewRun(false)}
        configRef={configRef}
        persistConfig={persistConfig}
        {...(projectId ? { projectId } : {})}
        {...(startSchemaRef ? { startSchemaRef } : {})}
      />
      <TransitionDialog
        configRef={configRef}
        persistConfig={persistConfig}
        {...(projectId ? { projectId } : {})}
      />
      <HeadersConfigDialog
        open={showHeaders}
        onClose={() => setShowHeaders(false)}
        initialHeaders={savedHeaders}
        onSave={(headers) => {
          setSavedHeaders(headers);
          const record: Record<string, string> = {};
          for (const h of headers) {
            record[h.name] = h.value;
          }
          setGlobalHeaders(record);
          const updated = { ...configRef.current, globalHeaders: record };
          persistConfig(updated);
        }}
      />
    </div>
  );
}
