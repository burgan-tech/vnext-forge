import { useState, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from '@vnext-forge-studio/designer-ui';
import type { ExecutionOverlay, CanvasTraversedTransition } from '@vnext-forge-studio/designer-ui';
import { useWorkflowDefinitionDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceTimeline } from '@monitoring/modules/instances/api/instances-queries';
import type { WorkflowDefinitionItem, WorkflowDefState, WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';
import { InstanceStatePanel } from './InstanceStatePanel';
import { InstanceTransitionPanel } from './InstanceTransitionPanel';

interface InstanceWorkflowCanvasProps {
  workflow: string;
  instanceId: string;
  currentState: string;
}

function normalizeTriggerType(t: unknown): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    switch (t.toLowerCase()) {
      case 'manual': return 0;
      case 'automatic': case 'auto': return 1;
      case 'scheduled': case 'timer': return 2;
      case 'event': return 3;
    }
  }
  return 0;
}

function toFlowCanvasJson(item: WorkflowDefinitionItem): Record<string, unknown> {
  const raw = item as any;

  // Case 1: Full vNext format — pass through unchanged.
  if (Array.isArray(raw.attributes?.states)) {
    return item as Record<string, unknown>;
  }

  // Case 2: Monitoring semi-flat — states at top level with nested transitions.
  if (Array.isArray(raw.states) && (raw.states.length === 0 || Array.isArray(raw.states[0]?.transitions))) {
    const states: any[] = raw.states;
    const initialState = states.find((s: any) => (s.stateType ?? s.type) === 1);
    const startTransition = initialState
      ? { key: '__start_transition__', target: initialState.key, triggerType: 0 }
      : undefined;

    return {
      key: item.key,
      attributes: {
        startTransition,
        states: states.map((s: any) => ({
          key: s.key,
          stateType: s.stateType ?? s.type ?? 2,
          labels: s.labels,
          transitions: (s.transitions ?? []).map((t: any) => ({
            key: t.key,
            target: t.target ?? t.to ?? '',
            triggerType: normalizeTriggerType(t.triggerType),
            triggerKind: normalizeTriggerType(t.triggerKind),
            labels: t.labels,
          })),
          onEntries: s.onEntries ?? [],
          onExits: s.onExits ?? [],
          view: s.view,
          errorBoundary: s.errorBoundary,
          subFlow: s.subFlow,
        })),
        ...(raw.cancel ? {
          cancel: { key: raw.cancel.key, target: raw.cancel.target ?? raw.cancel.to ?? '', availableIn: raw.cancel.availableIn ?? [] },
        } : {}),
        ...(raw.timeout ? {
          timeout: { key: raw.timeout.key, target: raw.timeout.target ?? raw.timeout.to ?? '', availableIn: raw.timeout.availableIn ?? [] },
        } : {}),
        ...(raw.updateData ? {
          updateData: { key: raw.updateData.key, target: raw.updateData.target ?? raw.updateData.to ?? '', availableIn: raw.updateData.availableIn ?? [] },
        } : {}),
      },
    };
  }

  // Case 3: Fully flat — separate top-level states[] and transitions[].
  const states = (item.states ?? []) as WorkflowDefState[];
  const transitions = (item.transitions ?? []) as WorkflowDefTransition[];

  const initialState = states.find((s) => s.type === 1);
  const startTransition = initialState
    ? { key: '__start_transition__', target: initialState.key, triggerType: 0 }
    : undefined;

  const transitionsByState = new Map<string, unknown[]>();
  for (const t of transitions) {
    const list = transitionsByState.get(t.from) ?? [];
    list.push({ key: t.key, target: t.to, triggerType: t.triggerType ?? 0 });
    transitionsByState.set(t.from, list);
  }

  return {
    key: item.key,
    attributes: {
      startTransition,
      states: states.map((s) => ({
        key: s.key,
        stateType: s.type,
        labels: s.labels,
        transitions: transitionsByState.get(s.key) ?? [],
      })),
    },
  };
}

function lookupState(
  item: WorkflowDefinitionItem,
  key: string,
): { state: WorkflowDefState; transitions: WorkflowDefTransition[] } | null {
  const raw = item as any;

  if (Array.isArray(raw.attributes?.states)) {
    const vs = (raw.attributes.states as any[]).find((s: any) => s.key === key);
    if (!vs) return null;
    return {
      state: { key: vs.key, type: vs.stateType ?? vs.type ?? 2, labels: vs.labels },
      transitions: (vs.transitions ?? []).map((t: any) => ({
        key: t.key,
        from: vs.key,
        to: t.target ?? t.to ?? '',
        triggerType: normalizeTriggerType(t.triggerType),
      })),
    };
  }

  if (Array.isArray(raw.states)) {
    const vs = (raw.states as any[]).find((s: any) => s.key === key);
    if (!vs) return null;
    if (Array.isArray(vs.transitions)) {
      return {
        state: { key: vs.key, type: vs.stateType ?? vs.type ?? 2, labels: vs.labels },
        transitions: (vs.transitions as any[]).map((t: any) => ({
          key: t.key,
          from: vs.key,
          to: t.target ?? t.to ?? '',
          triggerType: normalizeTriggerType(t.triggerType),
        })),
      };
    }
    const state = vs as WorkflowDefState;
    const transitions = (item.transitions ?? []).filter((t: any) => t.from === key) as WorkflowDefTransition[];
    return { state, transitions };
  }

  return null;
}

function lookupTransition(item: WorkflowDefinitionItem, key: string): WorkflowDefTransition | null {
  const raw = item as any;

  if (Array.isArray(raw.attributes?.states)) {
    for (const s of raw.attributes.states as any[]) {
      const t = (s.transitions ?? []).find((tr: any) => tr.key === key);
      if (t) return { key: t.key, from: s.key, to: t.target ?? t.to ?? '', triggerType: normalizeTriggerType(t.triggerType) };
    }
    return null;
  }

  if (Array.isArray(raw.states)) {
    for (const s of raw.states as any[]) {
      if (!Array.isArray(s.transitions)) break;
      const t = (s.transitions as any[]).find((tr: any) => tr.key === key);
      if (t) return { key: t.key, from: s.key, to: t.target ?? t.to ?? '', triggerType: normalizeTriggerType(t.triggerType) };
    }
  }

  return (item.transitions ?? []).find((t) => t.key === key) as WorkflowDefTransition | null ?? null;
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

  if (!definition) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading workflow canvas…
      </div>
    );
  }

  const workflowJson = toFlowCanvasJson(definition);
  const diagramJson = { nodePos: {} };

  const stateResult = selectedStateKey ? lookupState(definition, selectedStateKey) : null;
  const selectedState = stateResult?.state ?? null;
  const stateTransitions = stateResult?.transitions ?? [];

  const selectedTransition = selectedTransitionKey
    ? lookupTransition(definition, selectedTransitionKey)
    : null;

  const hasSidePanel = Boolean(selectedStateKey || selectedTransitionKey);

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-0 w-full gap-0">
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <FlowCanvas
            workflowJson={workflowJson}
            diagramJson={diagramJson}
            mode="instance-view"
            executionOverlay={executionOverlay}
            onNodeSelect={(key) => {
              if (!key || key === '__start__') {
                setSelectedStateKey(null);
                return;
              }
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
            <InstanceStatePanel
              state={selectedState}
              transitions={stateTransitions}
              timeline={timeline ?? null}
              currentState={currentState}
              onClose={() => setSelectedStateKey(null)}
            />
          )}
          {selectedTransition && (
            <InstanceTransitionPanel
              transition={selectedTransition}
              timeline={timeline ?? null}
              onClose={() => setSelectedTransitionKey(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
