import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RefreshCw } from 'lucide-react';

import { ComponentLinkProvider, type ComponentLinkHandlers } from '../../canvas-interaction/readonly/ComponentLinkContext';
import { resolveWorkflowScriptAbsolutePath } from '../../code-editor/createWorkflowScriptFile';
import { createIncidentLoaders, type IncidentLoaders } from '../../quick-run/components/IncidentSection';
import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import { DetailsBody } from '../../quick-run/components/panel-kit';
import { PanelToggleButton } from '../../quick-run/components/PanelToggleButton';
import { ResizableHandle } from '../../quick-run/components/ResizableHandle';
import { usePanelLayout } from '../../quick-run/hooks/usePanelLayout';
import { RuntimeErrorBanner } from '../../quick-run/components/RuntimeErrorBanner';
import { StatusBadge } from '../../quick-run/components/StatusBadge';
import * as QuickRunApi from '../../quick-run/QuickRunApi';
import type { CorrelationTreeNode, CorrelationTreeResponse, InstanceStatus } from '../../quick-run/types/quickrun.types';
import { runtimeSupports } from '../../quick-run/utils/runtimeFeatures';
import { useComponentIndex } from '../hooks/useComponentIndex';
import { useRuntimeVersion } from '../hooks/useRuntimeVersion';
import { useMonitorController } from '../hooks/useMonitorController';
import { findTransition } from '../../canvas-interaction/readonly/normalize';
import { lookupComponent } from '../model/componentIndex';
import { useDataHistory, type DataHistoryResult } from '../hooks/useDataHistory';
import { attributeRows } from '../model/dataAttribution';
import { childInstancesOf, childTarget, childWorkflowFile, drillAction } from '../model/correlation';
import { definitionDrift } from '../model/definitionDrift';
import { pickLabel } from '../model/monitorPath';
import type { MonitorLoadState, MonitorSelection, MonitorTarget, OpenComponentTarget } from '../types';
import { Breadcrumb } from './Breadcrumb';
import { CorrelationsPanel } from './CorrelationsPanel';
import { InstanceTab } from './InstanceTab';
import { IncidentsTab } from './IncidentsTab';
import { DataTab } from './DataTab';
import { MonitorCanvas } from './MonitorCanvas';
import { MonitorInspector } from './MonitorInspector';
import { PathTimeline } from './PathTimeline';

export interface MonitorShellProps {
  target: MonitorTarget;
  headers?: Record<string, string>;
  onOpenComponent?: (target: OpenComponentTarget) => void;
  /** Absolute path of a script file to open in the editor. */
  onOpenScript?: (absolutePath: string) => void;
  /** `isRoot` is false while a drilled-in child instance is on screen. */
  onOpenQuickRun?: (instanceId: string, isRoot: boolean) => void;
  onOpenFlowDesigner?: () => void;
}

const LAYOUT_KEY = 'vnext-forge.monitor.layout';
const LAYOUT_DEFAULTS = {
  right: { size: 340, open: true, min: 260, max: 640 },
  bottom: { size: 132, open: true, min: 88, max: 360 },
};
export type MonitorLayout = ReturnType<typeof usePanelLayout>;

const STATUS_KEYS = new Set<string>(['A', 'B', 'C', 'F', 'P']);
const EMPTY_HEADERS: Record<string, string> = {};

/** Wires loading and component links, then renders `MonitorShellView`. */
export function MonitorShell({ target, headers = EMPTY_HEADERS, onOpenComponent, onOpenScript, onOpenQuickRun, onOpenFlowDesigner }: MonitorShellProps) {
  const layout = usePanelLayout(LAYOUT_KEY, LAYOUT_DEFAULTS);
  const runtimeVersion = useRuntimeVersion(target.runtimeUrl);
  const controller = useMonitorController(target, headers, runtimeVersion);
  const level = controller.level;
  const index = useComponentIndex(level.projectId);

  const loadMetrics = useMemo<ElementMetricsLoader | undefined>(() => {
    if (runtimeSupports(runtimeVersion, 'elementMetrics') !== true) return undefined;
    return (kind, key) => {
      const params = {
        domain: level.domain,
        workflowKey: level.workflowKey,
        instanceId: level.instanceId,
        key,
        headers,
        ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}),
      };
      return kind === 'transition' ? QuickRunApi.getTransitionMetrics(params) : QuickRunApi.getStateMetrics(params);
    };
  }, [runtimeVersion, level, headers]);

  const incidentLoaders = useMemo<IncidentLoaders>(
    () =>
      createIncidentLoaders({
        domain: level.domain,
        workflowKey: level.workflowKey,
        instanceId: level.instanceId,
        headers,
        ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}),
      }),
    [level, headers],
  );

  const [dataTabOpenFor, setDataTabOpenFor] = useState<string | null>(null);
  const dataTabOpen = dataTabOpenFor === level.instanceId;
  const openDataTab = useCallback(() => setDataTabOpenFor(level.instanceId), [level.instanceId]);
  // Keys follow the last successful load of this instance, so they change only on a new load and not while loading/refreshing.
  const lastReady = useRef<{ instanceId: string; loadedAt: number } | null>(null);
  if (controller.load.kind === 'ready') lastReady.current = { instanceId: level.instanceId, loadedAt: controller.load.data.loadedAt };
  const loadedAt = lastReady.current?.instanceId === level.instanceId ? lastReady.current.loadedAt : 0;
  const dataHistory = useDataHistory(level, headers, loadedAt, dataTabOpen || controller.selection?.kind === 'transition');

  const [currentData, setCurrentData] = useState<{ key: string; value?: unknown; eTag?: string; failed?: boolean } | null>(null);
  const currentKey = `${level.instanceId}:${loadedAt}`;
  useEffect(() => {
    if (!dataTabOpen) return;
    let stale = false;
    void QuickRunApi.getData({
      domain: level.domain,
      workflowKey: level.workflowKey,
      instanceId: level.instanceId,
      headers,
      ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}),
    })
      .then((res) => {
        if (stale) return;
        setCurrentData(
          res.success && res.data.data !== undefined
            ? { key: currentKey, value: res.data.data, ...(res.data.eTag ? { eTag: res.data.eTag } : {}) }
            : { key: currentKey, failed: true },
        );
      })
      .catch(() => {
        if (!stale) setCurrentData({ key: currentKey, failed: true });
      });
    return () => {
      stale = true;
    };
  }, [dataTabOpen, currentKey, level, headers]);

  // A refresh that returns no tree keeps showing the last good one for this instance.
  const lastTree = useRef<{ instanceId: string; tree: CorrelationTreeResponse } | null>(null);
  if (controller.load.kind === 'ready' && controller.load.data.correlation) {
    lastTree.current = { instanceId: level.instanceId, tree: controller.load.data.correlation };
  }
  const load = useMemo(() => {
    const current = controller.load;
    if (current.kind !== 'ready' || current.data.correlation) return current;
    const kept = lastTree.current?.instanceId === level.instanceId ? lastTree.current.tree : null;
    return kept ? { ...current, data: { ...current.data, correlation: kept } } : current;
  }, [controller.load, level.instanceId]);

  const drillInto = useCallback(
    (node: CorrelationTreeNode) => {
      const action = drillAction(controller.levels, node.id);
      if (action.kind === 'pop') controller.popTo(action.index);
      else if (action.kind === 'drill') controller.drill(childTarget(level, node, childWorkflowFile(index, level, node)));
    },
    [level, index, controller.levels, controller.drill, controller.popTo],
  );

  const rootInstanceId = controller.levels[0]?.instanceId;
  const openQuickRunForLevel = useMemo(
    () => (onOpenQuickRun ? () => onOpenQuickRun(level.instanceId, level.instanceId === rootInstanceId) : undefined),
    [onOpenQuickRun, level.instanceId, rootInstanceId],
  );

  const links = useMemo<ComponentLinkHandlers>(() => {
    const handlers: ComponentLinkHandlers = {};
    if (onOpenComponent) {
      handlers.resolveComponent = (category, ref) => lookupComponent(index, category, ref.key);
      handlers.openComponent = (category, ref) => {
        const filePath = lookupComponent(index, category, ref.key);
        if (filePath) onOpenComponent({ category, key: ref.key, filePath });
      };
    }
    if (onOpenScript && level.workflowFilePath) {
      const dir = level.workflowFilePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
      handlers.openScript = (location) => onOpenScript(resolveWorkflowScriptAbsolutePath(dir, location));
    }
    return handlers;
  }, [index, onOpenComponent, onOpenScript, level.workflowFilePath]);

  return (
    <MonitorShellView
      target={level}
      levels={controller.levels}
      onPopTo={controller.popTo}
      onDrill={drillInto}
      load={load}
      selection={controller.selection}
      pathOnly={controller.pathOnly}
      onRefresh={controller.refresh}
      paused={controller.paused}
      onPausedChange={controller.setPaused}
      onSelect={controller.select}
      onPathOnly={controller.setPathOnly}
      links={links}
      layout={layout}
      incidentLoaders={incidentLoaders}
      {...(loadMetrics ? { loadMetrics } : {})}
      {...(openQuickRunForLevel ? { onOpenQuickRun: openQuickRunForLevel } : {})}
      dataHistory={dataHistory}
      onDataTabOpen={openDataTab}
      {...(currentData?.key === currentKey ? { currentData: currentData.value, currentDataFailed: !!currentData.failed, ...(currentData.eTag ? { currentETag: currentData.eTag } : {}) } : {})}
      isRoot={level.instanceId === rootInstanceId}
      {...(onOpenFlowDesigner ? { onOpenFlowDesigner } : {})}
    />
  );
}

export interface MonitorShellViewProps {
  /** The level on screen (top of the drill-down stack). */
  target: MonitorTarget;
  /** Drill-down stack, root first; the breadcrumb shows when it has more than one entry. */
  levels?: readonly MonitorTarget[];
  onPopTo?: (index: number) => void;
  onDrill?: (node: CorrelationTreeNode) => void;
  load: MonitorLoadState;
  selection: MonitorSelection;
  pathOnly: boolean;
  onRefresh: () => void;
  /** Live-update pause toggle; the button shows only when `onPausedChange` is given. */
  paused?: boolean;
  onPausedChange?: (value: boolean) => void;
  onSelect: (selection: MonitorSelection) => void;
  onPathOnly: (value: boolean) => void;
  links: ComponentLinkHandlers;
  /** Panel sizes/visibility (owned by MonitorShell; injectable for tests). */
  layout: MonitorLayout;
  loadMetrics?: ElementMetricsLoader;
  incidentLoaders?: IncidentLoaders;
  /** Opens Quick Run for the level on screen. */
  onOpenQuickRun?: () => void;
  /** False while a drilled-in child is on screen: Quick Run only knows the root workflow, so its actions hide. Defaults to true. */
  isRoot?: boolean;
  onOpenFlowDesigner?: () => void;
  /** Shared data-history hook result (owned by MonitorShell so it survives tab switches). */
  dataHistory?: DataHistoryResult;
  onDataTabOpen?: () => void;
  currentData?: unknown;
  currentDataFailed?: boolean;
  currentETag?: string;
}

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Props-only layout so the SSR tests can render every state. */
export function MonitorShellView(props: MonitorShellViewProps) {
  const { target, load, selection, pathOnly, onRefresh, onSelect, onPathOnly, links, layout } = props;
  const rightOpen = layout.isOpen('right');
  const bottomOpen = layout.isOpen('bottom');
  const setLayoutOpen = layout.setOpen;
  // Any new selection reveals the details panel.
  useEffect(() => {
    if (selection) setLayoutOpen('right', true);
  }, [selection, setLayoutOpen]);
  const rootQuickRun = props.isRoot === false ? undefined : props.onOpenQuickRun;
  const dh = props.dataHistory;
  const attributed = useMemo(
    () => (dh && load.kind === 'ready' ? attributeRows(dh.rows, load.data.history) : undefined),
    [dh?.rows, load],
  );

  const crumbs =
    props.levels && props.levels.length > 1 && props.onPopTo ? (
      <div className="border-b border-[var(--vscode-panel-border,#3c3c3c)] px-3 py-1">
        <Breadcrumb levels={props.levels} onPopTo={props.onPopTo} />
      </div>
    ) : null;

  if (load.kind === 'loading') {
    return (
      <>
        {crumbs}
        <p className={`py-12 text-center text-xs ${muted}`}>Loading instance…</p>
      </>
    );
  }
  if (load.kind === 'not-found') {
    return (
      <>
        {crumbs}
        <div className="flex flex-col items-center gap-2 py-12 text-xs">
          <p>Instance not found in {target.environmentName ?? 'this environment'}.</p>
          {rootQuickRun && (
            <button type="button" onClick={rootQuickRun} className="cursor-pointer underline">
              Back to Quick Run
            </button>
          )}
        </div>
      </>
    );
  }
  if (load.kind === 'error') {
    return (
      <>
        {crumbs}
        <div className="flex flex-col gap-2">
          <RuntimeErrorBanner title="Could not load the instance" error={load.error} />
          <button type="button" onClick={onRefresh} className="mx-2 cursor-pointer self-start rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-xs">
            Retry
          </button>
        </div>
      </>
    );
  }

  const { data, refreshing, staleError } = load;
  const { instance, history, definition } = data;
  const currentState = instance.metadata.currentState || null;
  const drift = definition.source === 'local' ? definitionDrift(definition.localVersion, instance.flowVersion) : null;
  const status = (instance.metadata.effectiveStatus ?? instance.metadata.status) as InstanceStatus;

  return (
    <ComponentLinkProvider value={links}>
      <div className="flex h-full min-h-0 flex-col text-[var(--vscode-foreground,#cccccc)]">
        {crumbs}
        <header className="flex items-center gap-2 border-b border-[var(--vscode-panel-border,#3c3c3c)] px-3 py-1.5 text-xs">
          <span className="truncate font-semibold">
            {target.workflowKey} · <span className="font-mono">{instance.key || instance.id.slice(0, 8)}</span>
          </span>
          {STATUS_KEYS.has(status) ? <StatusBadge status={status} /> : <span className="text-[10px]">{status}</span>}
          <span className={`truncate ${muted}`}>{currentState}</span>
          <span className="ml-auto flex items-center gap-2">
            {staleError && (
              <span className="rounded bg-[var(--vscode-inputValidation-warningBackground,#352a05)] px-1.5 text-[10px]" title={staleError.message}>
                Stale
              </span>
            )}
            <span className={`text-[10px] ${muted}`}>Updated {new Date(data.loadedAt).toLocaleTimeString()}</span>
            {props.onPausedChange && (
              <button
                type="button"
                onClick={() => props.onPausedChange?.(!props.paused)}
                aria-pressed={!!props.paused}
                aria-label={props.paused ? 'Resume live updates' : 'Pause live updates'}
                title={props.paused ? 'Resume live updates' : 'Pause live updates'}
                className="cursor-pointer rounded p-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]"
              >
                {props.paused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              title="Refresh"
              className="cursor-pointer rounded p-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)] disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            </button>
            <PanelToggleButton side="right" open={rightOpen} onToggle={() => layout.toggle('right')} label="details panel" />
            <PanelToggleButton side="bottom" open={bottomOpen} onToggle={() => layout.toggle('bottom')} label="path panel" />
          </span>
        </header>

        {drift && (
          <p role="status" className="border-b border-[var(--vscode-panel-border,#3c3c3c)] bg-[var(--vscode-inputValidation-warningBackground,#352a05)] px-3 py-1 text-[11px]">
            Local definition {drift.localVersion} ≠ instance {drift.instanceVersion} — the canvas may differ from what ran.
          </p>
        )}
        {definition.source === 'history' && (
          <p role="status" className={`border-b border-[var(--vscode-panel-border,#3c3c3c)] px-3 py-1 text-[11px] ${muted}`}>
            Local definition not found — showing only the states and transitions this instance went through.
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--vscode-editor-background,#1e1e1e)] [contain:layout]">
            <MonitorCanvas
              vm={definition.vm}
              diagram={definition.diagram}
              history={history}
              currentState={currentState}
              pathOnly={pathOnly}
              tasks={data.tasks}
              activeIncident={data.activeIncident}
              selection={selection}
              onSelect={onSelect}
            />
            <label className="absolute left-2 top-2 z-10 flex cursor-pointer items-center gap-1 rounded bg-[var(--vscode-editor-background,#1e1e1e)] px-2 py-1 text-[11px] shadow">
              <input type="checkbox" checked={pathOnly} onChange={(e) => onPathOnly(e.target.checked)} className="cursor-pointer" />
              Path only
            </label>
          </div>
          {rightOpen && (
            <>
              <ResizableHandle
                direction="left"
                valueNow={layout.size('right')}
                label="Resize details panel"
                onResize={(d) => layout.resize('right', d)}
              />
              <aside
                style={{ width: layout.size('right') }}
                className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-[var(--vscode-sideBar-border,var(--vscode-panel-border,#3c3c3c))] bg-[var(--vscode-sideBar-background,#252526)] text-[11px]"
              >
            <DetailsBody
              variant="panel"
              key={selection ? `${selection.kind}:${selection.key}` : 'none'}
              initialTab={selection ? 'inspector' : 'instance'}
              tabs={[
                {
                  id: 'inspector',
                  label: 'Inspector',
                  render: () => (
                    <MonitorInspector
                      vm={definition.vm}
                      history={history}
                      currentState={currentState}
                      selection={selection}
                      tasks={data.tasks}
                      {...(attributed ? { dataRowsByFiring: attributed } : {})}
                      {...(dh ? { allDataRows: dh.rows, dataHasNext: dh.hasNext } : {})}
                      {...(selection?.kind === 'state' && props.onDrill
                        ? { childInstances: childInstancesOf(data.correlation, instance.id, selection.key), onDrill: props.onDrill }
                        : {})}
                      {...(props.loadMetrics ? { loadMetrics: props.loadMetrics } : {})}
                      onClose={() => onSelect(null)}
                    />
                  ),
                },
                {
                  id: 'instance',
                  label: 'Instance',
                  render: () => (
                    <InstanceTab
                      instance={instance}
                      {...(definition.localVersion ? { localVersion: definition.localVersion } : {})}
                      {...(target.environmentName ? { environmentName: target.environmentName } : {})}
                      {...(rootQuickRun ? { onOpenQuickRun: rootQuickRun } : {})}
                      {...(props.onOpenFlowDesigner ? { onOpenFlowDesigner: props.onOpenFlowDesigner } : {})}
                    />
                  ),
                },
                {
                  id: 'incidents',
                  label: data.activeIncident ? 'Incidents (1)' : 'Incidents',
                  render: () => (
                    <IncidentsTab
                      active={data.activeIncident}
                      {...(props.incidentLoaders ? { loaders: props.incidentLoaders } : {})}
                      onShowOnCanvas={(e) => onSelect({ kind: 'state', key: e.state })}
                      {...(rootQuickRun ? { onOpenQuickRun: rootQuickRun } : {})}
                    />
                  ),
                },
                {
                  id: 'data',
                  label: 'Data',
                  render: () => (
                    <DataTab
                      history={history}
                      rows={dh?.rows ?? []}
                      state={dh?.state ?? 'idle'}
                      hasNext={dh?.hasNext ?? false}
                      error={dh?.error ?? null}
                      onLoadMore={dh?.loadMore ?? (() => undefined)}
                      labelFor={(key) => pickLabel(findTransition(definition.vm, key)?.labels, key)}
                      {...(props.onDataTabOpen ? { onOpen: props.onDataTabOpen } : {})}
                      {...('currentData' in props ? { current: props.currentData } : {})}
                      currentFailed={!!props.currentDataFailed}
                      {...(props.currentETag ? { currentETag: props.currentETag } : {})}
                    />
                  ),
                },
                {
                  id: 'correlations',
                  label: 'Correlations',
                  render: () => (
                    <CorrelationsPanel
                      correlation={data.correlation}
                      onRefresh={onRefresh}
                      {...(props.onDrill ? { onDrill: props.onDrill } : {})}
                    />
                  ),
                },
              ]}
            />
              </aside>
            </>
          )}
        </div>
        {bottomOpen && (
          <>
            <ResizableHandle
              orientation="horizontal"
              direction="left"
              valueNow={layout.size('bottom')}
              label="Resize path panel"
              onResize={(d) => layout.resize('bottom', d)}
            />
            <section
              aria-label="Path"
              style={{ height: layout.size('bottom') }}
              className="flex shrink-0 flex-col overflow-hidden border-t border-[var(--vscode-panel-border,#3c3c3c)] bg-[var(--vscode-panel-background,#1e1e1e)]"
            >
              <div className="shrink-0 border-b border-[var(--vscode-panel-border,#3c3c3c)] bg-[var(--vscode-sideBarSectionHeader-background,transparent)] px-1">
                <span className="-mb-px inline-block border-b-2 border-[var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder,#007fd4))] px-2 py-1 text-[11px]">Path</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <PathTimeline
                  history={history}
                  vm={definition.vm}
                  selectedKey={selection?.kind === 'transition' ? selection.key : null}
                  onSelect={onSelect}
                />
              </div>
            </section>
          </>
        )}
        </div>
      </div>
    </ComponentLinkProvider>
  );
}
