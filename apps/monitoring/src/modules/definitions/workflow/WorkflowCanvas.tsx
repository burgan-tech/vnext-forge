import { useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  FlowCanvas,
  normalizeDefinition,
  findState,
  findTransition,
  StateInspector,
  TransitionInspector,
  WorkflowMetadataInspector,
} from '@vnext-forge-studio/designer-ui';
import type { WorkflowDefinitionItem } from '@monitoring/shared/types/definitions-api';

interface WorkflowCanvasProps {
  definition: WorkflowDefinitionItem;
}

export function WorkflowCanvas({ definition }: WorkflowCanvasProps) {
  const [selectedStateKey, setSelectedStateKey] = useState<string | null>(null);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Single shared normalization → canvas JSON + inspector view model.
  // Memoized so node positions are not reset on selection-driven re-renders.
  const vm = useMemo(() => normalizeDefinition(definition as Record<string, unknown>), [definition]);
  const diagramJson = useMemo(() => ({ nodePos: {} }), []);

  const selectedState = selectedStateKey ? findState(vm, selectedStateKey) : null;
  const selectedTransition = selectedTransitionKey ? findTransition(vm, selectedTransitionKey) : null;

  const hasSidePanel = settingsOpen || Boolean(selectedStateKey || selectedTransitionKey);

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-0 w-full gap-0">
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <FlowCanvas
            workflowJson={vm.workflowJson}
            diagramJson={diagramJson}
            mode="workflow-view"
            workflowSettingsActive={settingsOpen}
            onToggleWorkflowSettings={() => {
              setSettingsOpen((v) => !v);
              setSelectedStateKey(null);
              setSelectedTransitionKey(null);
            }}
            onOpenWorkflowSettings={() => {
              setSettingsOpen(true);
              setSelectedStateKey(null);
              setSelectedTransitionKey(null);
            }}
            onNodeSelect={(key) => {
              if (!key || key === '__start__') {
                setSelectedStateKey(null);
                return;
              }
              setSettingsOpen(false);
              setSelectedStateKey(key);
              setSelectedTransitionKey(null);
            }}
            onEdgeSelect={(key) => {
              setSettingsOpen(false);
              setSelectedTransitionKey(key);
              setSelectedStateKey(null);
            }}
          />
        </ReactFlowProvider>
      </div>

      {hasSidePanel && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-background">
          {settingsOpen && (
            <WorkflowMetadataInspector workflow={vm.workflow} onClose={() => setSettingsOpen(false)} />
          )}
          {!settingsOpen && selectedState && (
            <StateInspector state={selectedState} onClose={() => setSelectedStateKey(null)} />
          )}
          {!settingsOpen && selectedTransition && (
            <TransitionInspector transition={selectedTransition} onClose={() => setSelectedTransitionKey(null)} />
          )}
        </div>
      )}
    </div>
  );
}
