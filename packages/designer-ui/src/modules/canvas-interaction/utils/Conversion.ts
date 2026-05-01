import type { Node, Edge } from '@xyflow/react';

export interface DiagramNodePos {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface DiagramData {
  nodePos: Record<string, DiagramNodePos>;
}

interface WorkflowState {
  key: string;
  stateType: number;
  subType?: number;
  // vnext uses "labels" (plural)
  labels?: Array<{ language: string; label: string }>;
  // fallback: some older formats use "label" (singular)
  label?: Array<{ language: string; label: string }>;
  onEntries?: unknown[];
  onExits?: unknown[];
  transitions?: WorkflowTransition[];
  sharedTransitions?: string[];
  view?: unknown;
  errorBoundary?: unknown;
  subFlow?: unknown;
}

interface WorkflowTransition {
  key: string;
  // vnext uses "target" not "to"
  target?: string;
  to?: string;
  triggerType?: number;
  triggerKind?: number;
  // vnext uses "labels" (plural)
  labels?: Array<{ language: string; label: string }>;
  label?: Array<{ language: string; label: string }>;
}

export interface VnextWorkflow {
  key: string;
  tags?: string[];
  attributes?: {
    // vnext uses "startTransition" not "start"
    startTransition?: { key: string; target?: string; to?: string };
    start?: { key: string; target?: string; to?: string };
    states?: WorkflowState[];
    sharedTransitions?: WorkflowTransition[];
    timeout?: unknown;
    cancel?: unknown;
  };
}

function getStateLabel(state: WorkflowState): string {
  // Support both "labels" (vnext standard) and "label" (fallback)
  const labels = state.labels || state.label;
  if (labels?.length) {
    const en = labels.find((l) => l.language === 'en');
    return en?.label || labels[0].label || state.key;
  }
  return state.key;
}

function getTransitionLabel(t: WorkflowTransition): string {
  // Support both "labels" (vnext standard) and "label" (fallback)
  const labels = t.labels || t.label;
  if (labels?.length) {
    const en = labels.find((l) => l.language === 'en');
    return en?.label || labels[0].label || t.key;
  }
  return t.key;
}

function getTransitionTarget(t: WorkflowTransition): string {
  // Support both "target" (vnext standard) and "to" (fallback)
  return t.target || t.to || '';
}

function getNodeType(stateType: number): string {
  switch (stateType) {
    case 1: return 'initialState';
    case 2: return 'intermediateState';
    case 3: return 'finalState';
    case 4: return 'subFlowState';
    case 5: return 'wizardState';
    default: return 'intermediateState';
  }
}

function getEdgeType(triggerType?: number): string {
  switch (triggerType) {
    case 0: return 'manualEdge';
    case 1: return 'autoEdge';
    case 2: return 'scheduledEdge';
    case 3: return 'eventEdge';
    default: return 'manualEdge';
  }
}

const DEFAULT_STATE_WIDTH = 220;
const DEFAULT_STATE_HEIGHT = 100;

export function workflowToReactFlow(
  workflow: VnextWorkflow,
  diagram: DiagramData
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const states = workflow.attributes?.states || [];
  // Support both "startTransition" (vnext standard) and "start" (fallback)
  const start = workflow.attributes?.startTransition || workflow.attributes?.start;
  const sharedTransitions = workflow.attributes?.sharedTransitions || [];

  // Start pseudo-node
  const startPos = diagram.nodePos?.['__start__'] || { x: 0, y: 0 };
  nodes.push({
    id: '__start__',
    type: 'startNode',
    position: startPos,
    data: { label: 'Start' },
  });

  // Start edge
  if (start) {
    const startTarget = getTransitionTarget(start as WorkflowTransition);
    if (startTarget) {
      edges.push({
        id: `__start__->${startTarget}`,
        source: '__start__',
        target: startTarget,
        type: 'manualEdge',
        data: { label: start.key, triggerType: 0 },
      });
    }
  }

  // State nodes
  for (const state of states) {
    const pos = diagram.nodePos?.[state.key] || { x: 200, y: 200 };
    const nodeData: Node = {
      id: state.key,
      type: getNodeType(state.stateType),
      position: pos,
      data: {
        label: getStateLabel(state),
        stateKey: state.key,
        stateType: state.stateType,
        subType: state.subType || 0,
        onEntryCount: state.onEntries?.length || 0,
        onExitCount: state.onExits?.length || 0,
        transitionCount: state.transitions?.length || 0,
        hasView: !!state.view,
        hasErrorBoundary: !!state.errorBoundary,
        hasSubFlow: !!state.subFlow,
      },
    };

    if (pos.width) nodeData.width = pos.width;
    if (pos.height) nodeData.height = pos.height;

    nodes.push(nodeData);

    // State transitions -> edges
    if (state.transitions) {
      for (const t of state.transitions) {
        let target = getTransitionTarget(t);
        // Resolve $self to the current state key (self-loop)
        if (target === '$self') target = state.key;
        if (target) {
          edges.push({
            id: `${state.key}->${target}::${t.key}`,
            source: state.key,
            target: target,
            type: getEdgeType(t.triggerType),
            data: {
              label: getTransitionLabel(t),
              transitionKey: t.key,
              triggerType: t.triggerType || 0,
              triggerKind: t.triggerKind || 0,
              isSelfRef: t.target === '$self' || target === state.key,
            },
          });
        }
      }
    }
  }

  // Shared transitions
  for (const st of sharedTransitions) {
    const targetStates = states.filter((s) =>
      s.sharedTransitions?.includes(st.key)
    );
    const sharedTarget = getTransitionTarget(st);
    if (sharedTarget) {
      for (const source of targetStates) {
        edges.push({
          id: `shared::${source.key}->${sharedTarget}::${st.key}`,
          source: source.key,
          target: sharedTarget,
          type: 'sharedEdge',
          data: {
            label: getTransitionLabel(st),
            transitionKey: st.key,
            triggerType: st.triggerType || 0,
            isShared: true,
          },
        });
      }
    }
  }

  return { nodes, edges };
}

export function reactFlowToPositions(nodes: Node[]): DiagramData {
  const nodePos: Record<string, DiagramNodePos> = {};
  for (const node of nodes) {
    const entry: DiagramNodePos = {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    };

    const width = node.width ?? node.measured?.width;
    const height = node.height ?? node.measured?.height;
    if (width && width !== DEFAULT_STATE_WIDTH && node.id !== '__start__') {
      entry.width = Math.round(width);
    }
    if (height && height !== DEFAULT_STATE_HEIGHT && node.id !== '__start__') {
      entry.height = Math.round(height);
    }

    nodePos[node.id] = entry;
  }
  return { nodePos };
}

/** Narrow store JSON to the workflow shape expected by the canvas converter. */
export function toVnextWorkflow(workflow: Record<string, unknown>): VnextWorkflow {
  return workflow as unknown as VnextWorkflow;
}

/** Read `nodePos` from persisted diagram JSON with basic structural validation. */
export function toDiagramData(diagram: Record<string, unknown>): DiagramData {
  const raw = diagram.nodePos;
  const nodePos: Record<string, DiagramNodePos> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        if (typeof o.x === 'number' && typeof o.y === 'number') {
          const entry: DiagramNodePos = { x: o.x, y: o.y };
          if (typeof o.width === 'number') entry.width = o.width;
          if (typeof o.height === 'number') entry.height = o.height;
          nodePos[k] = entry;
        }
      }
    }
  }
  return { nodePos };
}
