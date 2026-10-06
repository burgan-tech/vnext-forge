import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import { ComponentLinkProvider, type ComponentLinkHandlers } from '../../canvas-interaction/readonly/ComponentLinkContext';
import { resolveWorkflowScriptAbsolutePath } from '../../code-editor/createWorkflowScriptFile';
import { DetailsBody } from '../../quick-run/components/panel-kit';
import { RuntimeErrorBanner } from '../../quick-run/components/RuntimeErrorBanner';
import { StatusBadge } from '../../quick-run/components/StatusBadge';
import type { InstanceStatus } from '../../quick-run/types/quickrun.types';
import { useComponentIndex } from '../hooks/useComponentIndex';
import { useRuntimeVersion } from '../hooks/useRuntimeVersion';
import { useMonitorController } from '../hooks/useMonitorController';
import { lookupComponent } from '../model/componentIndex';
import { definitionDrift } from '../model/definitionDrift';
import type { MonitorLoadState, MonitorSelection, MonitorTarget, OpenComponentTarget } from '../types';
import { InstanceTab } from './InstanceTab';
import { MonitorCanvas } from './MonitorCanvas';
import { MonitorInspector } from './MonitorInspector';
import { PathTimeline } from './PathTimeline';

export interface MonitorShellProps {
  target: MonitorTarget;
  headers?: Record<string, string>;
  onOpenComponent?: (target: OpenComponentTarget) => void;
  /** Absolute path of a script file to open in the editor. */
  onOpenScript?: (absolutePath: string) => void;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

const STATUS_KEYS = new Set<string>(['A', 'B', 'C', 'F', 'P']);
const EMPTY_HEADERS: Record<string, string> = {};

/** Wires loading and component links, then renders `MonitorShellView`. */
export function MonitorShell({ target, headers = EMPTY_HEADERS, onOpenComponent, onOpenScript, onOpenQuickRun, onOpenFlowDesigner }: MonitorShellProps) {
  const runtimeVersion = useRuntimeVersion(target.runtimeUrl);
  const controller = useMonitorController(target, headers, runtimeVersion);
  const index = useComponentIndex(target.projectId);

  const links = useMemo<ComponentLinkHandlers>(() => {
    const handlers: ComponentLinkHandlers = {};
    if (onOpenComponent) {
      handlers.resolveComponent = (category, ref) => lookupComponent(index, category, ref.key);
      handlers.openComponent = (category, ref) => {
        const filePath = lookupComponent(index, category, ref.key);
        if (filePath) onOpenComponent({ category, key: ref.key, filePath });
      };
    }
    if (onOpenScript && target.workflowFilePath) {
      const dir = target.workflowFilePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
      handlers.openScript = (location) => onOpenScript(resolveWorkflowScriptAbsolutePath(dir, location));
    }
    return handlers;
  }, [index, onOpenComponent, onOpenScript, target.workflowFilePath]);

  return (
    <MonitorShellView
      target={target}
      load={controller.load}
      selection={controller.selection}
      pathOnly={controller.pathOnly}
      onRefresh={controller.refresh}
      onSelect={controller.select}
      onPathOnly={controller.setPathOnly}
      links={links}
      {...(onOpenQuickRun ? { onOpenQuickRun } : {})}
      {...(onOpenFlowDesigner ? { onOpenFlowDesigner } : {})}
    />
  );
}

export interface MonitorShellViewProps {
  target: MonitorTarget;
  load: MonitorLoadState;
  selection: MonitorSelection;
  pathOnly: boolean;
  onRefresh: () => void;
  onSelect: (selection: MonitorSelection) => void;
  onPathOnly: (value: boolean) => void;
  links: ComponentLinkHandlers;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Props-only layout so the SSR tests can render every state. */
export function MonitorShellView(props: MonitorShellViewProps) {
  const { target, load, selection, pathOnly, onRefresh, onSelect, onPathOnly, links } = props;

  if (load.kind === 'loading') {
    return <p className={`py-12 text-center text-xs ${muted}`}>Loading instance…</p>;
  }
  if (load.kind === 'not-found') {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-xs">
        <p>Instance not found in {target.environmentName ?? 'this environment'}.</p>
        {props.onOpenQuickRun && (
          <button type="button" onClick={props.onOpenQuickRun} className="cursor-pointer underline">
            Back to Quick Run
          </button>
        )}
      </div>
    );
  }
  if (load.kind === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <RuntimeErrorBanner title="Could not load the instance" error={load.error} />
        <button type="button" onClick={onRefresh} className="mx-2 cursor-pointer self-start rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-xs">
          Retry
        </button>
      </div>
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

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          <div className="relative min-h-0 overflow-hidden [contain:layout]">
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
          <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-[var(--vscode-panel-border,#3c3c3c)] text-[11px]">
            <DetailsBody
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
                      {...(props.onOpenQuickRun ? { onOpenQuickRun: props.onOpenQuickRun } : {})}
                      {...(props.onOpenFlowDesigner ? { onOpenFlowDesigner: props.onOpenFlowDesigner } : {})}
                    />
                  ),
                },
              ]}
            />
          </aside>
        </div>

        <PathTimeline
          history={history}
          vm={definition.vm}
          selectedKey={selection?.kind === 'transition' ? selection.key : null}
          onSelect={onSelect}
        />
      </div>
    </ComponentLinkProvider>
  );
}
