import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from '../../../../ui/Resizable.js';
import {
  getStateTypeLabel,
  getStateTypeColor,
  getSubTypeLabel,
  getSubTypeBadge,
  getLabel,
} from './tabs/PropertyPanelHelpers';
import { Badge } from './tabs/PropertyPanelShared';
import { GeneralTab } from './tabs/GeneralTab';
import { TasksTab } from './tabs/TasksTab';
import { TransitionsTab } from './tabs/TransitionsTab';
import { SubFlowTab } from './tabs/SubFlowTab';
import { ErrorBoundaryTab } from './tabs/ErrorBoundaryTab';
import { StartNodePanel } from './tabs/StartNodePanel';
import { MousePointer2, PanelRightOpen, X } from 'lucide-react';

type Tab = 'general' | 'tasks' | 'transitions' | 'subflow' | 'error-boundary';

const FLOW_EDITOR_CANVAS_PANEL_ID = 'flow-editor-canvas';
const FLOW_EDITOR_PROPERTIES_PANEL_ID = 'flow-editor-properties';

/** Flow editor sağ özellik sütunu — `FlowEditorView` ile uyumlu piksel sınırları + auto-collapse. */
export const statePropertyPanelResizableProps = {
  autoCollapseBelowMin: true,
  collapseOvershootPx: 30,
  minSize: 250,
  maxSize: 600,
} as const;

/**
 * Canvas + sağ özellik paneli satırı. Özellik sütunu `statePropertyPanelResizableProps` ile yeniden boyutlanır.
 */
export function WorkflowPropertySidebarResizableRow({
  canvas,
  sidePanel,
}: {
  canvas: ReactNode;
  sidePanel: ReactNode;
}) {
  const propertiesPanelRef = usePanelRef();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const defaultLayout = useMemo(() => {
    const { minSize, maxSize } = statePropertyPanelResizableProps;
    if (typeof window === 'undefined') {
      return {
        [FLOW_EDITOR_CANVAS_PANEL_ID]: 72,
        [FLOW_EDITOR_PROPERTIES_PANEL_ID]: 28,
      } as const;
    }
    const rowEstimatePx = Math.max(480, window.innerWidth - 80);
    const sidePx = Math.min(maxSize, Math.max(minSize, Math.round(rowEstimatePx * 0.22) + 150));
    const sidePct = (100 * sidePx) / rowEstimatePx;
    const canvasPct = 100 - sidePct;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return {
      [FLOW_EDITOR_CANVAS_PANEL_ID]: r(canvasPct),
      [FLOW_EDITOR_PROPERTIES_PANEL_ID]: r(sidePct),
    } as const;
  }, []);

  const handlePropertiesResize = useCallback(() => {
    const api = propertiesPanelRef.current;
    if (!api) return;
    setIsCollapsed(api.isCollapsed());
  }, [propertiesPanelRef]);

  const handleExpand = useCallback(() => {
    propertiesPanelRef.current?.expand();
  }, [propertiesPanelRef]);

  return (
    <ResizablePanelGroup
      className="flex h-full min-h-0 w-full flex-1"
      defaultLayout={defaultLayout}
      orientation="horizontal">
      <ResizablePanel
        className="relative min-h-0 min-w-0"
        id={FLOW_EDITOR_CANVAS_PANEL_ID}
        minSize="35%">
        {canvas}
        {isCollapsed && (
          <button
            type="button"
            onClick={handleExpand}
            className="bg-surface/90 border-border-subtle text-muted-foreground hover:bg-secondary-muted hover:text-secondary-icon hover:border-secondary-border absolute top-1/2 right-2 z-30 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition-all"
            title="Show properties panel"
            aria-label="Show properties panel">
            <PanelRightOpen size={16} />
          </button>
        )}
      </ResizablePanel>
      <ResizableHandle className="aria-[orientation=vertical]:before:right-0! aria-[orientation=vertical]:before:left-auto!" />
      <ResizablePanel
        className="bg-surface/80 flex min-h-0 min-w-0 flex-col overflow-hidden shadow-[-4px_0_16px_rgba(0,0,0,0.03)] backdrop-blur-sm"
        id={FLOW_EDITOR_PROPERTIES_PANEL_ID}
        panelRef={propertiesPanelRef}
        onResize={handlePropertiesResize}
        {...statePropertyPanelResizableProps}>
        {sidePanel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function StatePropertyPanel({ defaultTaskFolder }: { defaultTaskFolder?: string } = {}) {
  const { workflowJson, selectedNodeId, updateWorkflow, setSelectedNode } = useWorkflowStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const state = useMemo(() => {
    if (!workflowJson || !selectedNodeId) return null;
    const attrs = (workflowJson as any).attributes;
    if (!attrs?.states) return null;
    return attrs.states.find((s: any) => s.key === selectedNodeId) || null;
  }, [workflowJson, selectedNodeId]);

  const startTransition = useMemo(() => {
    if (!workflowJson || selectedNodeId !== '__start__') return null;
    const attrs = (workflowJson as any).attributes;
    return attrs?.startTransition || attrs?.start || null;
  }, [workflowJson, selectedNodeId]);

  if (selectedNodeId === '__start__' && startTransition) {
    return <StartNodePanel startTransition={startTransition} />;
  }

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="px-6 text-center">
          <div className="bg-muted text-subtle mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl">
            <MousePointer2 size={24} />
          </div>
          <div className="text-muted-foreground text-[13px] font-semibold">Select a state</div>
          <div className="text-subtle mt-1 text-[11px]">Click on a node in the canvas</div>
        </div>
      </div>
    );
  }

  const stateType = state.stateType || 2;
  const subType = state.subType;
  const entries = state.onEntries || [];
  const exits = state.onExits || [];
  const transitions = state.transitions || [];

  const errorHandlerCount = state.errorBoundary?.onError?.length ?? 0;

  const tabs: { key: Tab; label: string; count?: number; show: boolean }[] = [
    { key: 'general', label: 'General', show: true },
    { key: 'tasks', label: 'Tasks', count: entries.length + exits.length, show: true },
    { key: 'transitions', label: 'Transitions', count: transitions.length, show: true },
    { key: 'subflow', label: 'SubFlow', show: stateType === 4 },
    { key: 'error-boundary', label: 'Error Boundary', count: errorHandlerCount, show: true },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border-subtle bg-surface border-b px-3 py-2">
        <div className="mb-0.5 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="text-foreground truncate text-[13px] font-bold tracking-tight">
              {state.key}
            </span>
            <Badge className={getStateTypeColor(stateType)}>{getStateTypeLabel(stateType)}</Badge>
            {subType > 0 && (
              <Badge className={getSubTypeBadge(subType)}>{getSubTypeLabel(subType)}</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
            title="Close panel"
            aria-label="Close panel">
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {getLabel(state) && (
          <div className="text-muted-foreground truncate text-[11px] leading-snug">
            {getLabel(state)}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-border-subtle bg-muted-surface flex border-b px-0.5">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer border-b-2 px-2.5 py-1.5 text-[11px] font-semibold tracking-tight whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-secondary-border text-secondary-icon'
                  : 'text-muted-foreground hover:text-primary-icon hover:border-muted-border-hover border-transparent'
              }`}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    activeTab === tab.key
                      ? 'bg-secondary-muted text-secondary-icon'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {activeTab === 'general' && <GeneralTab state={state} updateWorkflow={updateWorkflow} />}
        {activeTab === 'tasks' && <TasksTab state={state} defaultTaskFolder={defaultTaskFolder} />}
        {activeTab === 'transitions' && <TransitionsTab state={state} />}
        {activeTab === 'subflow' && <SubFlowTab state={state} />}
        {activeTab === 'error-boundary' && <ErrorBoundaryTab state={state} updateWorkflow={updateWorkflow} />}
      </div>
    </div>
  );
}
