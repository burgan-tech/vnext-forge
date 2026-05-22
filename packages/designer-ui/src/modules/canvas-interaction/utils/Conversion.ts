import type { Node, Edge } from '@xyflow/react';

export interface DiagramNodePos {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Free-form annotation block placed on the canvas — not tied to
 * any workflow state. Stored in the diagram JSON (not the workflow
 * JSON) so it never affects runtime behavior. Position / size live
 * directly on the note record (not in `nodePos`) so the workflow
 * doesn't accidentally treat the note id as a state key.
 */
export interface DiagramNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  /** Background palette key — `yellow` (default), `blue`, `green`, `pink`. */
  color?: 'yellow' | 'blue' | 'green' | 'pink';
  /**
   * Font size in pixels. Free-form number (clamped 8–48 by the UI)
   * so the user can pick whatever feels right rather than being
   * locked to S/M/L presets.
   */
  fontSize?: number;
  /**
   * Custom text color as a hex string (`#rrggbb`). Optional — when
   * absent, the palette's default text color is used.
   */
  textColor?: string;
}

/**
 * Visual grouping container — a translucent dashed rectangle
 * behind a cluster of state nodes that the author wants to
 * label together (e.g. "Approval flow", "Payment retry").
 * Diagram-only metadata.
 */
export interface DiagramGroup {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

export interface DiagramData {
  nodePos: Record<string, DiagramNodePos>;
  notes?: DiagramNote[];
  groups?: DiagramGroup[];
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
  availableIn?: string[];
}

interface WorkflowLevelTransition {
  key: string;
  target?: string;
  to?: string;
  [k: string]: unknown;
}

export interface VnextWorkflow {
  key: string;
  tags?: string[];
  attributes?: {
    startTransition?: { key: string; target?: string; to?: string };
    start?: { key: string; target?: string; to?: string };
    states?: WorkflowState[];
    sharedTransitions?: WorkflowTransition[];
    updateData?: WorkflowLevelTransition;
    cancel?: WorkflowLevelTransition;
    timeout?: WorkflowLevelTransition;
    exit?: WorkflowLevelTransition;
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
        data: { label: start.key, transitionKey: start.key, triggerType: 0 },
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
        subFlowProcessKey: (state.subFlow as any)?.process?.key || '',
        subFlowProcessDomain: (state.subFlow as any)?.process?.domain || '',
      },
    };

    if (pos.width) nodeData.width = pos.width;
    if (pos.height) nodeData.height = pos.height;

    nodes.push(nodeData);

    // State transitions -> edges
    if (state.transitions) {
      for (const t of state.transitions) {
        let target = getTransitionTarget(t);
        // `$self` keyword is now treated identically to an explicit
        // self-loop (`target === state.key`). The previous design
        // synthesized a virtual `selfRefNode` floating off the side
        // of the source state; that meant `$self`-style transitions
        // looked nothing like explicit self-loops, broke handle
        // symmetry on the virtual node (target-only on the left),
        // and bloated the React Flow node list. Both shapes are now
        // a single self-loop edge whose source equals its target.
        const isSelfKeyword = target === '$self';
        if (isSelfKeyword) target = state.key;

        if (target === state.key) {
          // Self-loop (explicit `target === state.key` OR legacy
          // `$self` keyword — both now render as the same
          // arc-back-to-source curve in TransitionEdge).
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
              isSelfLoop: true,
              ...(isSelfKeyword ? { isSelfKeyword: true } : {}),
            },
          });
        } else if (target) {
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
          reconnectable: false,
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

  // Workflow-level transition pseudo-nodes
  const wfTransitions: Array<{
    id: string;
    kind: string;
    label: string;
    data: WorkflowLevelTransition | undefined;
    defaultOffset: { x: number; y: number };
  }> = [
    { id: '__wf_updateData__', kind: 'updateData', label: 'Update Data', data: workflow.attributes?.updateData, defaultOffset: { x: -180, y: 0 } },
    { id: '__wf_cancel__', kind: 'cancel', label: 'Cancel', data: workflow.attributes?.cancel, defaultOffset: { x: -180, y: 60 } },
    { id: '__wf_timeout__', kind: 'timeout', label: 'Timeout', data: workflow.attributes?.timeout, defaultOffset: { x: -180, y: 120 } },
    { id: '__wf_exit__', kind: 'exit', label: 'Exit', data: workflow.attributes?.exit, defaultOffset: { x: -180, y: 180 } },
  ];

  for (const wt of wfTransitions) {
    if (!wt.data) continue;
    const pos = diagram.nodePos?.[wt.id] || wt.defaultOffset;
    nodes.push({
      id: wt.id,
      type: 'workflowTransitionNode',
      position: pos,
      data: { kind: wt.kind, label: wt.label },
      selectable: true,
      deletable: false,
    });

    const target = wt.data.target || wt.data.to || '';
    if (target && target !== '$self') {
      edges.push({
        id: `${wt.id}->${target}`,
        source: wt.id,
        target,
        type: 'manualEdge',
        reconnectable: false,
        data: { label: wt.data.key || wt.kind, triggerType: 0, isWorkflowLevel: true },
      });
    }

    const availableIn = (wt.data.availableIn as string[] | undefined) || [];
    for (const stateKey of availableIn) {
      edges.push({
        id: `${stateKey}->${wt.id}::availableIn`,
        source: stateKey,
        target: wt.id,
        type: 'manualEdge',
        reconnectable: false,
        data: { label: '', triggerType: 0, isWorkflowLevel: true, isAvailableIn: true },
      });
    }
  }

  // Shared transitions as workflow-level nodes (visual representation)
  for (let i = 0; i < sharedTransitions.length; i++) {
    const st = sharedTransitions[i];
    const nodeId = `__wf_shared_${st.key}__`;
    const pos = diagram.nodePos?.[nodeId] || { x: -180, y: 240 + i * 60 };
    nodes.push({
      id: nodeId,
      type: 'workflowTransitionNode',
      position: pos,
      data: { kind: 'shared', label: `Shared: ${st.key}` },
      selectable: true,
      deletable: false,
    });

    const sharedTarget = getTransitionTarget(st);
    if (sharedTarget) {
      edges.push({
        id: `${nodeId}->${sharedTarget}`,
        source: nodeId,
        target: sharedTarget,
        type: 'sharedEdge',
        reconnectable: false,
        data: { label: getTransitionLabel(st), transitionKey: st.key, triggerType: 0, isShared: true, isWorkflowLevel: true },
      });
    }

    const availableIn = st.availableIn || [];
    for (const stateKey of availableIn) {
      edges.push({
        id: `${stateKey}->${nodeId}::availableIn`,
        source: stateKey,
        target: nodeId,
        type: 'manualEdge',
        reconnectable: false,
        data: { label: '', triggerType: 0, isWorkflowLevel: true, isAvailableIn: true },
      });
    }
  }

  // ── Parallel edge fan-out ──────────────────────────────────────────────
  // Multiple transitions between the same two states (e.g. `approve` /
  // `reject` from `pending` → `decided`) would otherwise collapse onto
  // the exact same bezier path, making them indistinguishable and
  // unclickable. We tag every edge with its `parallelIndex` (0-based)
  // and `parallelCount` for that source→target pair (direction-aware so
  // a→b and b→a still draw their own arcs). `TransitionEdge` reads
  // these and offsets the bezier control point along the edge's
  // perpendicular normal, fanning the lanes out like ribbon tracks.
  const pairCounts = new Map<string, number>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const key = `${edge.source} ${edge.target}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  const pairIndex = new Map<string, number>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const key = `${edge.source} ${edge.target}`;
    const count = pairCounts.get(key) ?? 1;
    if (count <= 1) continue;
    const idx = pairIndex.get(key) ?? 0;
    edge.data = {
      ...(edge.data ?? {}),
      parallelIndex: idx,
      parallelCount: count,
    };
    pairIndex.set(key, idx + 1);
  }

  // ── Outbound-edge label staggering ──────────────────────────────────
  // When a source state has N outgoing edges to N *different* targets
  // that happen to sit in a similar direction (e.g. five "downward"
  // transitions from a hub state), every edge's geometric midpoint
  // lands in roughly the same region of the canvas. Their pill
  // labels overlap visually even though the lines themselves are
  // distinguishable.
  //
  // We tag each non-self-loop, non-parallel edge with its
  // `outboundIndex` and `outboundCount` (per source). TransitionEdge
  // uses this to shift the label along the source→target line at
  // `t = (i + 1) / (N + 1)` so the labels fan out at distinct
  // distances from the source instead of stacking at midpoint.
  //
  // Parallel edges (same source-target pair) keep their existing
  // perpendicular-offset midpoint placement; the perpendicular
  // displacement already separates their labels.
  const outboundCounts = new Map<string, number>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (edge.source === edge.target) continue; // self-loops have own layout
    const data = (edge.data ?? {}) as { parallelCount?: number };
    if (typeof data.parallelCount === 'number' && data.parallelCount > 1) continue;
    outboundCounts.set(edge.source, (outboundCounts.get(edge.source) ?? 0) + 1);
  }
  const outboundIndices = new Map<string, number>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (edge.source === edge.target) continue;
    const data = (edge.data ?? {}) as { parallelCount?: number };
    if (typeof data.parallelCount === 'number' && data.parallelCount > 1) continue;
    const count = outboundCounts.get(edge.source) ?? 1;
    if (count <= 1) continue;
    const idx = outboundIndices.get(edge.source) ?? 0;
    edge.data = {
      ...(edge.data ?? {}),
      outboundIndex: idx,
      outboundCount: count,
    };
    outboundIndices.set(edge.source, idx + 1);
  }

  // Visual groups — backdrop containers (no workflow semantics).
  // Rendered FIRST so they sit at the back of the z-stack; state
  // nodes paint on top. The `zIndex: -1` flag is what tells React
  // Flow to keep them behind everything else.
  if (diagram.groups && diagram.groups.length > 0) {
    for (const group of diagram.groups) {
      nodes.push({
        id: group.id,
        type: 'groupNode',
        position: { x: group.x, y: group.y },
        width: group.width,
        height: group.height,
        data: { label: group.label, color: group.color ?? 'slate' },
        selectable: true,
        deletable: true,
        zIndex: -1,
      });
    }
  }

  // Sticky notes — render as `noteNode` nodes inside React Flow.
  // They're visual-only (no workflow semantics) and are stored
  // separately from `nodePos` so workflow state ids can't collide
  // with note ids. Notes also participate in selection / drag like
  // regular nodes.
  if (diagram.notes && diagram.notes.length > 0) {
    for (const note of diagram.notes) {
      nodes.push({
        id: note.id,
        type: 'noteNode',
        position: { x: note.x, y: note.y },
        width: note.width,
        height: note.height,
        data: {
          text: note.text,
          color: note.color ?? 'yellow',
          fontSize: note.fontSize ?? 13,
          ...(note.textColor ? { textColor: note.textColor } : {}),
        },
        // Notes shouldn't connect to anything by default — but they
        // should be draggable, selectable, and deletable. We
        // explicitly allow these flags.
        selectable: true,
        deletable: true,
      });
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

/** Read `nodePos` and `notes` from persisted diagram JSON with structural validation. */
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

  // Sticky notes — optional. Each entry must carry the minimum
  // shape (id, x, y, width, height, text); a malformed entry is
  // silently skipped rather than rejecting the whole diagram.
  const rawNotes = diagram.notes;
  let notes: DiagramNote[] | undefined;
  if (Array.isArray(rawNotes)) {
    notes = [];
    for (const entry of rawNotes as unknown[]) {
      if (!entry || typeof entry !== 'object') continue;
      const o = entry as Record<string, unknown>;
      if (
        typeof o.id !== 'string' ||
        typeof o.x !== 'number' ||
        typeof o.y !== 'number' ||
        typeof o.width !== 'number' ||
        typeof o.height !== 'number'
      ) {
        continue;
      }
      const note: DiagramNote = {
        id: o.id,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        text: typeof o.text === 'string' ? o.text : '',
      };
      if (
        o.color === 'yellow' ||
        o.color === 'blue' ||
        o.color === 'green' ||
        o.color === 'pink'
      ) {
        note.color = o.color;
      }
      // Accept numeric fontSize (8..96, clamped). Legacy
      // 'sm'/'md'/'lg' values from earlier builds are upgraded
      // to numeric so existing diagrams keep working.
      if (typeof o.fontSize === 'number' && Number.isFinite(o.fontSize)) {
        note.fontSize = Math.min(96, Math.max(8, Math.round(o.fontSize)));
      } else if (o.fontSize === 'sm') {
        note.fontSize = 11;
      } else if (o.fontSize === 'md') {
        note.fontSize = 13;
      } else if (o.fontSize === 'lg') {
        note.fontSize = 16;
      }
      // Text color — accept any `#rrggbb` (or `#rgb`) hex.
      if (typeof o.textColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.textColor)) {
        note.textColor = o.textColor;
      }
      notes.push(note);
    }
  }

  // Visual groups — same shape as notes minus the `text` field
  // plus a `label`. Same defensive parsing strategy.
  const rawGroups = diagram.groups;
  let groups: DiagramGroup[] | undefined;
  if (Array.isArray(rawGroups)) {
    groups = [];
    for (const entry of rawGroups as unknown[]) {
      if (!entry || typeof entry !== 'object') continue;
      const o = entry as Record<string, unknown>;
      if (
        typeof o.id !== 'string' ||
        typeof o.x !== 'number' ||
        typeof o.y !== 'number' ||
        typeof o.width !== 'number' ||
        typeof o.height !== 'number'
      ) {
        continue;
      }
      const group: DiagramGroup = {
        id: o.id,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        label: typeof o.label === 'string' ? o.label : '',
      };
      if (
        o.color === 'slate' ||
        o.color === 'indigo' ||
        o.color === 'emerald' ||
        o.color === 'amber' ||
        o.color === 'rose'
      ) {
        group.color = o.color;
      }
      groups.push(group);
    }
  }

  return {
    nodePos,
    ...(notes && notes.length > 0 ? { notes } : {}),
    ...(groups && groups.length > 0 ? { groups } : {}),
  };
}
