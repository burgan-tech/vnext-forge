import { useCallback, useEffect, useRef, useState } from 'react';

import { callApi } from '../../api/client';
import * as QuickRunApi from './QuickRunApi';
import type { SchemaReference, WorkflowBucketConfig } from './QuickRunApi';
import { BrandPaletteDialog } from './components/BrandPaletteDialog';
import { ContextPanel } from './components/ContextPanel';
import { HeadersConfigDialog } from './components/HeadersConfigDialog';
import { InstanceDashboard } from './components/InstanceDashboard';
import { NewRunDialog } from './components/NewRunDialog';
import { PanelToggleButton } from './components/PanelToggleButton';
import { QuickRunSidebar } from './components/QuickRunSidebar';
import { QuickRunStatusBar } from './components/QuickRunStatusBar';
import { QuickRunTabBar } from './components/QuickRunTabBar';
import { ResizableHandle } from './components/ResizableHandle';
import { TransitionDialog } from './components/TransitionDialog';
import { useFocusInstance, type FocusRequest } from './hooks/useFocusInstance';
import { QUICKRUN_LAYOUT_DEFAULTS, QUICKRUN_LAYOUT_KEY } from './hooks/quickRunLayout';
import { cappedResizeDelta } from './hooks/panelLayout';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useQuickRunPolling } from './hooks/useQuickRunPolling';
import { useQuickRunStore } from './store/quickRunStore';
import type { OpenFunctionRunTarget, OpenMonitorTarget, OpenSubFlowTarget } from './types/quickrun.types';
import { extractExecutionTypes } from './utils/executionMode';
import { extractLabelsMap } from './utils/extractLabelsMap';
import { checkRuntimeHealth } from '../workflow-execution/WorkflowExecutionApi';
import { useProjectStore } from '../../store/useProjectStore';
import { useToolHeadersStore } from '../../store/useToolHeadersStore';

const DASHBOARD_MIN = 280;
const HANDLE_WIDTH = 5;

interface HealthMessage {
  type: 'quickrun:health';
  status: 'healthy' | 'unhealthy' | 'unknown';
  runtimeDomain?: string;
  runtimeVersion?: string;
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
  /**
   * Open one of the running instance's functions in the Function Quick
   * Runner, bound to this workflow + instance.
   *
   * A callback rather than navigation, because `designer-ui` owns no router:
   * the web shell turns it into a route, the extension into a webview panel
   * — the same split `FlowEditorView.onOpenQuickRun` uses. When omitted the
   * catalog is still listed, without an Open button.
   */
  onOpenFunctionRun?: (target: OpenFunctionRunTarget) => void;
  /**
   * Open the sub-flow behind a correlation — either its own Quick Runner or
   * its workflow definition in the designer. Same host split as
   * `onOpenFunctionRun`: `designer-ui` resolves the workflow file, the host
   * turns it into a route (web) or a panel/editor (extension). When omitted
   * the Correlations tab renders without action buttons.
   */
  onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void;
  /**
   * Open the Instance Monitor for the active instance. Host split as for
   * `onOpenFunctionRun`: the extension opens a panel, the web shell a route.
   * When omitted the Monitor button is hidden.
   */
  onOpenMonitor?: (target: OpenMonitorTarget) => void;
  /** Instance to bring into focus — e.g. from the monitor's Open in Quick Run. A new `nonce` re-applies it. */
  focusRequest?: FocusRequest;
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
  onOpenFunctionRun,
  onOpenSubFlowTarget,
  onOpenMonitor,
  focusRequest,
}: QuickRunShellProps) {
  const setWorkflowContext = useQuickRunStore((s) => s.setWorkflowContext);
  const setGlobalHeaders = useQuickRunStore((s) => s.setGlobalHeaders);
  const setToolWideHeaders = useQuickRunStore((s) => s.setToolWideHeaders);
  const toolWideHeaders = useToolHeadersStore((s) => s.headers);
  const setRuntimeHealth = useQuickRunStore((s) => s.setRuntimeHealth);
  const setFlowLabels = useQuickRunStore((s) => s.setFlowLabels);
  const setFlowExecutionTypes = useQuickRunStore((s) => s.setFlowExecutionTypes);
  const setPollingConfig = useQuickRunStore((s) => s.setPollingConfig);
  const flowLabels = useQuickRunStore((s) => s.flowLabels);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBrandPalette, setShowBrandPalette] = useState(false);
  const [savedHeaders, setSavedHeaders] = useState<{ name: string; value: string; isSecret?: boolean }[]>([]);
  const configRef = useRef<WorkflowBucketConfig>(QuickRunApi.createEmptyConfig(workflowKey));
  const layout = usePanelLayout(QUICKRUN_LAYOUT_KEY, QUICKRUN_LAYOUT_DEFAULTS);
  const leftOpen = layout.isOpen('left');
  const rightOpen = layout.isOpen('right');
  const contextPanelReveal = useQuickRunStore((s) => s.contextPanelReveal);
  const revealSeen = useRef(contextPanelReveal);
  const { setOpen } = layout;
  const rowRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // Keep the dashboard at least DASHBOARD_MIN wide: a side panel may grow only into the room the other panel leaves.
  const resizeSide = useCallback((panel: 'left' | 'right', delta: number) => {
    const current = layoutRef.current;
    const other = panel === 'left' ? 'right' : 'left';
    const width = rowRef.current?.clientWidth ?? 0;
    const otherWidth = current.isOpen(other) ? current.size(other) + HANDLE_WIDTH : 0;
    const cap = width > 0 ? Math.max(0, width - otherWidth - HANDLE_WIDTH - DASHBOARD_MIN) : Infinity;
    current.resize(panel, cappedResizeDelta(delta, current.size(panel), cap));
  }, []);
  const resizeLeft = useCallback((d: number) => resizeSide('left', d), [resizeSide]);
  const resizeRight = useCallback((d: number) => resizeSide('right', d), [resizeSide]);

  // Any `setContextPanelTab` call brings the context panel forward; the
  // mount value is skipped so a persisted "hidden" state survives load.
  useEffect(() => {
    if (revealSeen.current === contextPanelReveal) return;
    revealSeen.current = contextPanelReveal;
    setOpen('right', true);
  }, [contextPanelReveal, setOpen]);

  useEffect(() => {
    setWorkflowContext(domain, workflowKey, environmentName, environmentUrl);
  }, [domain, workflowKey, environmentName, environmentUrl, setWorkflowContext]);

  // Declared after the workflow-context effect: it keys on the store's domain /
  // workflowKey, so it runs once the context reset above has landed.
  useFocusInstance(focusRequest, environmentUrl);

  // Mirror the Forge-wide header store into `useQuickRunStore` so the
  // pseudo-ui delegate's live-getter pattern (`getBucketConfig` /
  // `getSessionHeaders`) can read tool-wide headers the same way — see
  // `InstanceDashboard`/`TransitionDialog`'s `getToolWideHeaders` getter.
  useEffect(() => {
    setToolWideHeaders(toolWideHeaders);
  }, [toolWideHeaders, setToolWideHeaders]);

  // The view-editor webview populates `useProjectStore` via `HostEditorBridge`;
  // Quick Run is a separate VS Code panel (own isolated runtime) so we have to
  // call `setActiveProject` ourselves. The extension host puts the workspace
  // folder path into `projectId` (see `apps/extension/src/extension.ts`,
  // `workspaceFolders[0]?.uri.fsPath`), so it doubles as both the id and the
  // path. Without this, BrandPaletteDialog and useBrandPaletteFromWorkspace
  // would see "no active project". The web shell has already hydrated the
  // project (its `projectId` is the project id, not a path), so an active
  // project with the same id is kept — overwriting its path with the id broke
  // every project-relative read (e.g. the workflow file → `core/core/...`).
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  useEffect(() => {
    if (!projectId) return;
    if (useProjectStore.getState().activeProject?.id === projectId) return;
    setActiveProject({
      id: projectId,
      domain,
      path: projectId,
      linked: true,
    });
  }, [projectId, domain, setActiveProject]);

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
        setFlowExecutionTypes(extractExecutionTypes(flowJson));
      } catch { /* malformed JSON — ignore */ }
    });
  }, [projectPath, setFlowLabels, setFlowExecutionTypes]);

  const persistConfig = useCallback((cfg: WorkflowBucketConfig) => {
    configRef.current = cfg;
    void QuickRunApi.saveWorkflowConfig(domain, workflowKey, cfg);
  }, [domain, workflowKey]);

  const setRuntimeDomain = useQuickRunStore((s) => s.setRuntimeDomain);
  const setRuntimeVersion = useQuickRunStore((s) => s.setRuntimeVersion);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as HealthMessage | undefined;
      if (msg?.type === 'quickrun:health') {
        setRuntimeHealth(msg.status);
        if (msg.runtimeDomain) {
          setRuntimeDomain(msg.runtimeDomain);
        }
        if (msg.runtimeVersion) {
          setRuntimeVersion(msg.runtimeVersion);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setRuntimeHealth, setRuntimeDomain, setRuntimeVersion]);

  // Probe the runtime once per environment so version-gated surfaces
  // (correlation tree, metrics, executionType locks) know what they talk to.
  // Works in both shells; the extension's health push above may refine it.
  useEffect(() => {
    let cancelled = false;
    setRuntimeVersion(null);
    void checkRuntimeHealth(environmentUrl).then((res) => {
      if (cancelled || !res.success) return;
      if (res.data.version) setRuntimeVersion(res.data.version);
      if (res.data.domain) setRuntimeDomain(res.data.domain);
    });
    return () => {
      cancelled = true;
    };
  }, [environmentUrl, setRuntimeVersion, setRuntimeDomain]);

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
    <div className="flex h-screen flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)] [&_button:not(:disabled)]:cursor-pointer [&_summary]:cursor-pointer" role="application" aria-label="Quick Run — workflow manager">
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
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={() => setShowBrandPalette(true)}
            title="Brand JSON palette"
          >
            Brand JSON
          </button>
        </div>
        <div className="flex items-center gap-2">
          <PanelToggleButton side="left" open={leftOpen} onToggle={() => layout.toggle('left')} label="instances panel" />
          <PanelToggleButton side="right" open={rightOpen} onToggle={() => layout.toggle('right')} label="context panel" />
          <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">
            {domain}/{flowLabels?.workflowLabel ?? workflowKey}
          </span>
        </div>
      </div>

      <QuickRunTabBar />
      <div id="quickrun-main" ref={rowRef} className="flex flex-1 min-h-0">
        {leftOpen && (
          <>
            <div
              style={{ width: layout.size('left') }}
              className="flex-shrink-0 border-r border-[var(--vscode-sideBar-border,var(--vscode-panel-border,#3c3c3c))] bg-[var(--vscode-sideBar-background,#252526)]"
            >
              <QuickRunSidebar
                {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})}
                {...(onOpenMonitor ? { onOpenMonitor } : {})}
              />
            </div>
            <ResizableHandle
              onResize={resizeLeft}
              direction="right"
              valueNow={layout.size('left')}
              valueMin={QUICKRUN_LAYOUT_DEFAULTS.left.min}
              valueMax={QUICKRUN_LAYOUT_DEFAULTS.left.max}
              label="Resize instances panel"
            />
          </>
        )}
        <div className="min-w-[280px] flex-1">
          <InstanceDashboard
            configRef={configRef}
            persistConfig={persistConfig}
            onOpenFunctionRun={onOpenFunctionRun}
            {...(onOpenMonitor ? { onOpenMonitor } : {})}
          />
        </div>
        {rightOpen && (
          <>
            <ResizableHandle
              onResize={resizeRight}
              direction="left"
              valueNow={layout.size('right')}
              valueMin={QUICKRUN_LAYOUT_DEFAULTS.right.min}
              valueMax={QUICKRUN_LAYOUT_DEFAULTS.right.max}
              label="Resize context panel"
            />
            <div
              style={{ width: layout.size('right') }}
              className="flex-shrink-0 border-l border-[var(--vscode-sideBar-border,var(--vscode-panel-border,#3c3c3c))] bg-[var(--vscode-sideBar-background,#252526)]"
            >
              <ContextPanel {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})} />
            </div>
          </>
        )}
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
      <BrandPaletteDialog
        open={showBrandPalette}
        onOpenChange={setShowBrandPalette}
      />
    </div>
  );
}
