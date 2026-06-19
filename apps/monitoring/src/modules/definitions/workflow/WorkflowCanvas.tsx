import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from '@vnext-forge-studio/designer-ui';
import type { WorkflowDefinitionItem, WorkflowDefState, WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';
import { MonitoringStatePanel } from './MonitoringStatePanel';
import { MonitoringTransitionPanel } from './MonitoringTransitionPanel';

interface WorkflowCanvasProps {
  definition: WorkflowDefinitionItem;
}

// ── Format detection ─────────────────────────────────────────────────────────
//
// The monitoring definition API may return three different shapes:
//
//   1. Full vNext format      — { attributes: { states: [...] } }
//      (same JSON that the designer reads from disk)
//
//   2. Monitoring semi-flat   — { states: [{ stateType, transitions: [...] }] }
//      (states at top level with nested transitions per state;
//       triggerType is a string "manual"/"automatic"/"scheduled"/"event")
//
//   3. Fully flat             — { states: [...], transitions: [...] }
//      (separate flat arrays, transitions have `from`/`to` fields)

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
        // Workflow-level transitions (cancel, timeout, updateData)
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

// ── Side panel data lookup ────────────────────────────────────────────────────

function lookupState(
  item: WorkflowDefinitionItem,
  key: string,
): { state: WorkflowDefState; transitions: WorkflowDefTransition[] } | null {
  const raw = item as any;

  // Case 1: Full vNext format
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

  // Cases 2 & 3: states at top level (with or without nested transitions)
  if (Array.isArray(raw.states)) {
    const vs = (raw.states as any[]).find((s: any) => s.key === key);
    if (!vs) return null;

    // Case 2: nested transitions in state
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

    // Case 3: flat transitions array
    const state = vs as WorkflowDefState;
    const transitions = (item.transitions ?? []).filter((t: any) => t.from === key) as WorkflowDefTransition[];
    return { state, transitions };
  }

  return null;
}

function lookupTransition(item: WorkflowDefinitionItem, key: string): WorkflowDefTransition | null {
  const raw = item as any;

  // Case 1: Full vNext format
  if (Array.isArray(raw.attributes?.states)) {
    for (const s of raw.attributes.states as any[]) {
      const t = (s.transitions ?? []).find((tr: any) => tr.key === key);
      if (t) return { key: t.key, from: s.key, to: t.target ?? t.to ?? '', triggerType: normalizeTriggerType(t.triggerType) };
    }
    return null;
  }

  // Cases 2 & 3: states at top level
  if (Array.isArray(raw.states)) {
    for (const s of raw.states as any[]) {
      if (!Array.isArray(s.transitions)) break; // Case 3: fall through to flat lookup
      const t = (s.transitions as any[]).find((tr: any) => tr.key === key);
      if (t) return { key: t.key, from: s.key, to: t.target ?? t.to ?? '', triggerType: normalizeTriggerType(t.triggerType) };
    }
  }

  // Case 3: flat transitions array
  return (item.transitions ?? []).find((t) => t.key === key) as WorkflowDefTransition | null ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkflowCanvas({ definition }: WorkflowCanvasProps) {
  const [selectedStateKey, setSelectedStateKey] = useState<string | null>(null);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);

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
            mode="workflow-view"
            onNodeSelect={(key) => {
              // Pseudo-nodes have no entry in the definition
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
            <MonitoringStatePanel
              state={selectedState}
              transitions={stateTransitions}
              onClose={() => setSelectedStateKey(null)}
            />
          )}
          {selectedTransition && (
            <MonitoringTransitionPanel
              transition={selectedTransition}
              onClose={() => setSelectedTransitionKey(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
