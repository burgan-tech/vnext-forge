import { useMemo, useState } from 'react';
import { useWorkflowStore } from '@app/store/useWorkflowStore';
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
import { MousePointer2 } from 'lucide-react';

type Tab = 'general' | 'tasks' | 'transitions' | 'subflow' | 'error-boundary';

export function StatePropertyPanel() {
  const { workflowJson, selectedNodeId, updateWorkflow } = useWorkflowStore();
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

  const tabs: { key: Tab; label: string; count?: number; show: boolean }[] = [
    { key: 'general', label: 'General', show: true },
    { key: 'tasks', label: 'Tasks', count: entries.length + exits.length, show: true },
    { key: 'transitions', label: 'Transitions', count: transitions.length, show: true },
    { key: 'subflow', label: 'SubFlow', show: stateType === 4 },
    { key: 'error-boundary', label: 'Errors', show: !!state.errorBoundary },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border-subtle bg-surface border-b px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-foreground truncate text-[14px] font-bold tracking-tight">
            {state.key}
          </span>
          <Badge className={getStateTypeColor(stateType)}>{getStateTypeLabel(stateType)}</Badge>
          {subType > 0 && (
            <Badge className={getSubTypeBadge(subType)}>{getSubTypeLabel(subType)}</Badge>
          )}
        </div>
        {getLabel(state) && (
          <div className="text-muted-foreground truncate text-[12px]">{getLabel(state)}</div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-border-subtle bg-muted-surface flex border-b px-1">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer border-b-2 px-3 py-2.5 text-[12px] font-semibold tracking-tight whitespace-nowrap transition-all ${
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
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {activeTab === 'general' && <GeneralTab state={state} updateWorkflow={updateWorkflow} />}
        {activeTab === 'tasks' && <TasksTab state={state} />}
        {activeTab === 'transitions' && <TransitionsTab state={state} />}
        {activeTab === 'subflow' && <SubFlowTab state={state} />}
        {activeTab === 'error-boundary' && <ErrorBoundaryTab state={state} />}
      </div>
    </div>
  );
}
