import { useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  FlowCanvas,
  normalizeDefinition,
  findState,
  findTransition,
  StateInspector,
  TransitionInspector,
} from '@vnext-forge-studio/designer-ui';
import type { ExecutionOverlay, CanvasTraversedTransition } from '@vnext-forge-studio/designer-ui';
import { useWorkflowDefinitionDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceTimeline } from '@monitoring/modules/instances/api/instances-queries';
import { InstanceStatePanel } from './InstanceStatePanel';
import { InstanceTransitionPanel } from './InstanceTransitionPanel';

interface InstanceWorkflowCanvasProps {
  workflow: string;
  instanceId: string;
  currentState: string;
}

export function InstanceWorkflowCanvas({ workflow, instanceId, currentState }: InstanceWorkflowCanvasProps) {
  const { data: definition } = useWorkflowDefinitionDetail(workflow);
  const { data: timeline } = useInstanceTimeline(workflow, instanceId);

  const [selectedStateKey, setSelectedStateKey] = useState<string | null>(null);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);

  const executionOverlay = useMemo<ExecutionOverlay | undefined>(() => {
    if (!timeline) return undefined;
    const traversed: CanvasTraversedTransition[] = timeline.transitions.map((t) => ({
      transitionId: t.transitionId,
      fromState: t.fromState,
      toState: t.toState,
    }));
    return { traversedTransitions: traversed, currentState };
  }, [timeline, currentState]);

  // Memoized before the early return to keep hook order stable (see WorkflowCanvas for full rationale:
  // unmemoized objects reset node positions to center on every selection-driven re-render).
  const vm = useMemo(
    () => (definition ? normalizeDefinition(definition as Record<string, unknown>) : null),
    [definition],
  );
  const diagramJson = useMemo(() => ({ nodePos: {} }), []);

  if (!definition || !vm) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading workflow canvas…
      </div>
    );
  }

  const selectedState = selectedStateKey ? findState(vm, selectedStateKey) : null;
  const selectedTransition = selectedTransitionKey ? findTransition(vm, selectedTransitionKey) : null;
  const hasSidePanel = Boolean(selectedStateKey || selectedTransitionKey);

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-0 w-full gap-0">
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <FlowCanvas
            workflowJson={vm.workflowJson}
            diagramJson={diagramJson}
            mode="instance-view"
            executionOverlay={executionOverlay}
            onNodeSelect={(key) => {
              if (!key || key === '__start__') { setSelectedStateKey(null); return; }
              setSelectedStateKey(key);
              setSelectedTransitionKey(null);
            }}
            onEdgeSelect={(key) => {
              setSelectedTransitionKey(key);
              setSelectedStateKey(null);
            }}
          />
        </ReactFlowProvider>
      </div>

      {hasSidePanel && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-background">
          {selectedState && (
            <StateInspector state={selectedState} onClose={() => setSelectedStateKey(null)}>
              <InstanceStatePanel
                timeline={timeline ?? null}
                currentState={currentState}
                stateKey={selectedState.key}
              />
            </StateInspector>
          )}
          {selectedTransition && (
            <TransitionInspector transition={selectedTransition} onClose={() => setSelectedTransitionKey(null)}>
              <InstanceTransitionPanel
                timeline={timeline ?? null}
                transitionKey={selectedTransition.key}
              />
            </TransitionInspector>
          )}
        </div>
      )}
    </div>
  );
}
