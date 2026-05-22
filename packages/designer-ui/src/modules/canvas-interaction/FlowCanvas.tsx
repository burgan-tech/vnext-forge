import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore as useReactFlowStore,
  reconnectEdge,
  type OnConnect,
  type OnNodesChange,
  type Connection,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas-overrides.css';

import { nodeTypes } from './components/nodes';
import { edgeTypes } from './components/edges';
import { FloatingConnectionLine } from './components/edges/FloatingConnectionLine';
import { SharedEdgeMarkers } from './components/edges/SharedEdgeMarkers';
import {
  SmartGuidesOverlay,
  computeSmartGuides,
  type SmartGuide,
  type NodeBBox,
} from './components/SmartGuides';
import { BulkActionsToolbar } from './components/BulkActionsToolbar';
import { exportCanvasPng, exportCanvasSvg } from './utils/canvasExport';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { EmptyCanvasGuide } from './components/EmptyCanvasGuide';
import { SaveStatusIndicator } from './components/SaveStatusIndicator';
import { WorkflowInsights } from './components/WorkflowInsights';
import { lintWorkflow, detectPatterns } from './utils/workflowLint';
import { getFloatingHandleIds } from './utils/floating-edge-utils';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import {
  workflowToReactFlow,
  reactFlowToPositions,
  toDiagramData,
  toVnextWorkflow,
} from './utils/Conversion';
import { layoutFlow } from './utils/Layout';
import { CanvasToolbar } from './components/panels/CanvasToolbar';
import { CanvasSearchSpotlight } from './components/panels/CanvasSearchSpotlight';
import { buildCanvasSearchIndex } from './utils/canvas-search-index';
import {
  CanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
  WfNodeContextMenu,
} from './components/menus/CanvasContextMenu';
import {
  CanvasViewSettingsProvider,
  useCanvasViewSettings,
  resolveArrowSize,
  resolveBackgroundGap,
} from './context/CanvasViewSettingsContext';
import { NoteEditingProvider, useNoteEditing } from './context/NoteEditingContext';

interface FlowCanvasProps {
  workflowJson: Record<string, unknown>;
  diagramJson: Record<string, unknown>;
  workflowSettingsActive?: boolean;
  onToggleWorkflowSettings?: () => void;
  onOpenWorkflowSettings?: (section?: string) => void;
}

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  reconnectable: 'target' as const,
};

type ContextMenuState =
  | null
  | { type: 'pane'; screenX: number; screenY: number; flowX: number; flowY: number }
  | { type: 'node'; screenX: number; screenY: number; nodeId: string }
  | { type: 'wfNode'; screenX: number; screenY: number; nodeId: string; sectionKind: string }
  | {
      type: 'edge';
      screenX: number;
      screenY: number;
      sourceStateKey: string;
      transitionKey: string;
    };

function FlowCanvasInner({
  workflowJson,
  diagramJson,
  workflowSettingsActive,
  onToggleWorkflowSettings,
  onOpenWorkflowSettings,
}: FlowCanvasProps) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  // `isDirty` drives the SaveStatusIndicator chip in the top-right
  // corner so users see at-a-glance whether the workflow has
  // unsaved changes. The chip also remembers the last successful
  // save timestamp to show "Saved Ns ago".
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Mark the save timestamp whenever `isDirty` transitions
  // back to false (a save just succeeded).
  const prevDirtyRef = useRef(isDirty);
  useEffect(() => {
    if (prevDirtyRef.current && !isDirty) {
      setLastSavedAt(Date.now());
    }
    prevDirtyRef.current = isDirty;
  }, [isDirty]);
  const {
    setSelectedNode,
    setSelectedEdge,
    updateDiagram,
    markClean,
    addState,
    removeState,
    duplicateState,
    changeStateType,
    addTransition,
    removeTransition,
    changeTransitionTrigger,
    reconnectTransition,
  } = useWorkflowStore();
  const { fitView, screenToFlowPosition, getViewport, getInternalNode } = useReactFlow();
  const { settings } = useCanvasViewSettings();
  const autoLayoutDone = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // `?` key opens the keyboard shortcuts overlay; dialog manages
  // its own Escape-to-close listener so we only need a boolean.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitViewFollowUpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const searchItems = useMemo(
    () => buildCanvasSearchIndex(workflowJson),
    [workflowJson],
  );

  const hasInitialState = useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    const states: any[] = attrs?.states ?? [];
    return states.some((s: any) => s.stateType === 1);
  }, [workflowJson]);

  // Convert workflow JSON to ReactFlow nodes/edges
  const {
    nodes: computedNodes,
    edges: computedEdges,
    needsLayout,
  } = useMemo(() => {
    const diagram = toDiagramData(diagramJson);
    const result = workflowToReactFlow(toVnextWorkflow(workflowJson), diagram);
    const hasPositions = Object.keys(diagram.nodePos).length > 0;
    return { ...result, needsLayout: !hasPositions };
  }, [workflowJson, diagramJson]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const visibleEdges = useMemo(() => {
    if (settings.showWorkflowEdges) return edges;
    return edges.filter((e) => !(e.data as Record<string, unknown> | undefined)?.isWorkflowLevel);
  }, [edges, settings.showWorkflowEdges]);

  // ─── Selection-pulse: compute which edges + nodes should
  //     animate when a node is selected. Three modes:
  //       - single-hop : direct in/out edges + their other endpoint
  //       - wave       : BFS layer-by-layer with stagger delay
  //       - reachability: every forward-reachable edge until cleared
  //
  // The pulse classes (`vf-pulse-edge-L{n}`, `vf-pulse-edge-reach`,
  // `vf-pulse-node-L{n}`) are read by CSS in canvas-overrides.css
  // which animates `stroke-dashoffset` and node ring scaling. A
  // setTimeout clears single-hop/wave after the animation finishes
  // (1.5s / 3s); reachability is static and clears on next change.
  const [pulseEdgeClass, setPulseEdgeClass] = useState<Map<string, string>>(new Map());
  const [pulseNodeClass, setPulseNodeClass] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const mode = settings.pulseAnimation;
    if (mode === 'off' || !selectedNodeId) {
      setPulseEdgeClass(new Map());
      setPulseNodeClass(new Map());
      return;
    }

    // Build forward adjacency: source -> [edge]
    const outAdj = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!e.source) continue;
      const list = outAdj.get(e.source);
      if (list) list.push(e);
      else outAdj.set(e.source, [e]);
    }

    const edgeClasses = new Map<string, string>();
    const nodeClasses = new Map<string, string>();

    if (mode === 'single-hop') {
      // Both incoming AND outgoing direct edges — gives the user the
      // full one-step neighborhood, not just downstream.
      for (const e of edges) {
        if (e.source === selectedNodeId || e.target === selectedNodeId) {
          edgeClasses.set(e.id, 'vf-pulse-edge-L0');
          const other = e.source === selectedNodeId ? e.target : e.source;
          if (other) nodeClasses.set(other, 'vf-pulse-node-L0');
        }
      }
    } else if (mode === 'wave') {
      // BFS forward, label each edge with the hop layer (0..4 capped)
      // so CSS can stagger their animation-delay. Limited to 5 hops
      // to keep the visual short — deeper graphs get a fade-out.
      const visited = new Set<string>([selectedNodeId]);
      let frontier: string[] = [selectedNodeId];
      let layer = 0;
      const MAX_HOPS = 5;

      while (frontier.length > 0 && layer < MAX_HOPS) {
        const nextFrontier: string[] = [];
        for (const nodeId of frontier) {
          const outs = outAdj.get(nodeId) ?? [];
          for (const e of outs) {
            if (!edgeClasses.has(e.id)) {
              edgeClasses.set(e.id, `vf-pulse-edge-L${layer}`);
            }
            if (e.target && !visited.has(e.target)) {
              visited.add(e.target);
              nodeClasses.set(e.target, `vf-pulse-node-L${layer}`);
              nextFrontier.push(e.target);
            }
          }
        }
        frontier = nextFrontier;
        layer++;
      }
    } else if (mode === 'reachability') {
      // Plain forward-closure: every downstream edge gets the same
      // "reach" class. No layer stagger — the highlight is static
      // until selection changes, so the user can read the closure
      // calmly without animation churn.
      const visited = new Set<string>([selectedNodeId]);
      const queue = [selectedNodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const outs = outAdj.get(cur) ?? [];
        for (const e of outs) {
          edgeClasses.set(e.id, 'vf-pulse-edge-reach');
          if (e.target && !visited.has(e.target)) {
            visited.add(e.target);
            nodeClasses.set(e.target, 'vf-pulse-node-reach');
            queue.push(e.target);
          }
        }
      }
    } else if (mode === 'reverse-reachability') {
      // Reverse-closure: highlight every UPSTREAM edge and every
      // state that can reach the selected node. Answers "where
      // could this state arrive from?". Builds an inverse
      // adjacency on the fly (target → [edge]) and BFS-traverses
      // it. Reuses the same `vf-pulse-edge-reach` /
      // `vf-pulse-node-reach` classes so the visual signal is
      // identical to forward-reach — direction is conveyed by
      // the user's mental model, not by a different style.
      const inAdj = new Map<string, Edge[]>();
      for (const e of edges) {
        if (!e.target) continue;
        const list = inAdj.get(e.target);
        if (list) list.push(e);
        else inAdj.set(e.target, [e]);
      }
      const visited = new Set<string>([selectedNodeId]);
      const queue = [selectedNodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const ins = inAdj.get(cur) ?? [];
        for (const e of ins) {
          edgeClasses.set(e.id, 'vf-pulse-edge-reach');
          if (e.source && !visited.has(e.source)) {
            visited.add(e.source);
            nodeClasses.set(e.source, 'vf-pulse-node-reach');
            queue.push(e.source);
          }
        }
      }
    }

    setPulseEdgeClass(edgeClasses);
    setPulseNodeClass(nodeClasses);

    // No auto-clear timeout. The pulse persists for as long as the
    // user keeps a node selected — clearing it on a deadline (the
    // earlier 1.5s/3s behavior) felt jarring because the visual
    // affordance vanished while the selection was still active.
    // Classes are reset only when:
    //   - the user selects a different node (effect re-runs)
    //   - the user clears the selection (selectedNodeId → null)
    //   - the pulse mode is changed to 'off'
    // All of those flow through the early-return at the top of
    // this effect.
  }, [selectedNodeId, settings.pulseAnimation, edges]);

  // ─── Direct-connectivity highlighting (always on when something
  //     is selected). Independent of `pulseAnimation`. Adds the
  //     `vf-connected` class to:
  //       - edges that touch the selected node (in OR out)
  //       - target/source nodes on the other end of those edges
  //
  // Focus Mode uses these classes to keep the immediate
  // neighborhood at full opacity while the rest of the canvas
  // dims. Without this the user complained that "even the
  // selected state's own arrows go dark, which makes no sense".
  const connectedEdgeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedNodeId || e.target === selectedNodeId) set.add(e.id);
    }
    return set;
  }, [selectedNodeId, edges]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedNodeId && e.target) set.add(e.target);
      if (e.target === selectedNodeId && e.source) set.add(e.source);
    }
    return set;
  }, [selectedNodeId, edges]);

  // Merge pulse + connectivity classes into the edges/nodes React
  // Flow renders. Identity-equal to the input arrays when no
  // pulse and no selection are active (so React Flow's internal
  // memo passes through cheaply).
  const decoratedEdges = useMemo(() => {
    if (pulseEdgeClass.size === 0 && connectedEdgeIds.size === 0) return visibleEdges;
    return visibleEdges.map((e) => {
      const extra: string[] = [];
      const pulseCls = pulseEdgeClass.get(e.id);
      if (pulseCls) extra.push(pulseCls);
      if (connectedEdgeIds.has(e.id)) extra.push('vf-connected');
      if (extra.length === 0) return e;
      const existing = e.className ?? '';
      return { ...e, className: existing ? `${existing} ${extra.join(' ')}` : extra.join(' ') };
    });
  }, [visibleEdges, pulseEdgeClass, connectedEdgeIds]);

  const decoratedNodes = useMemo(() => {
    if (pulseNodeClass.size === 0 && connectedNodeIds.size === 0) return nodes;
    return nodes.map((n) => {
      const extra: string[] = [];
      const pulseCls = pulseNodeClass.get(n.id);
      if (pulseCls) extra.push(pulseCls);
      if (connectedNodeIds.has(n.id)) extra.push('vf-connected');
      if (extra.length === 0) return n;
      const existing = n.className ?? '';
      return { ...n, className: existing ? `${existing} ${extra.join(' ')}` : extra.join(' ') };
    });
  }, [nodes, pulseNodeClass, connectedNodeIds]);

  // ─── Smart Guides — alignment lines while dragging
  //
  // While the user drags a state node, we compute which other
  // nodes' top/center/bottom edges (horizontal alignment) or
  // left/center/right edges (vertical alignment) line up with
  // the dragged node within a 6 flow-pixel threshold. The match
  // produces purple dashed guides drawn by `SmartGuidesOverlay`
  // and clears on drag-stop.
  //
  // We skip the synthetic `__start__` / `__wf_*` pseudo-nodes —
  // they shouldn't be alignment anchors (they don't map to user
  // states). The dragged node itself is excluded automatically
  // because we filter on id.
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);

  const collectBBoxes = useCallback((draggedId: string): NodeBBox[] => {
    const list: NodeBBox[] = [];
    for (const n of nodes) {
      if (n.id === draggedId) continue;
      if (n.id.startsWith('__start__') || n.id.startsWith('__wf_')) continue;
      const w = n.width ?? n.measured?.width ?? 220;
      const h = n.height ?? n.measured?.height ?? 100;
      list.push({ id: n.id, x: n.position.x, y: n.position.y, width: w, height: h });
    }
    return list;
  }, [nodes]);

  // Group drag tracking — defined here (before onNodeDrag) so
  // the translate logic inside onNodeDrag has access. Populated by
  // `onNodeDragStartGuides` when the user starts dragging a
  // `group_*` node. Cleared on drag stop.
  const groupDragRef = useRef<{
    groupId: string;
    groupStart: { x: number; y: number };
    members: Array<{ id: string; startX: number; startY: number }>;
  } | null>(null);

  // Multi-node drag tracking — React Flow v12 doesn't auto-translate
  // sibling selected nodes when the user drags one of them (even
  // with `selectNodesOnDrag={false}` keeping the multi-selection
  // intact). We do it manually with the same pattern as group
  // drag: snapshot the other selected nodes' positions at drag
  // start, then on every drag tick translate them by the same
  // delta. Cleared on drag stop after persisting to the diagram.
  const multiDragRef = useRef<{
    draggedId: string;
    draggedStart: { x: number; y: number };
    siblings: Array<{ id: string; startX: number; startY: number }>;
  } | null>(null);

  const onNodeDrag = useCallback(
    (_: unknown, draggedNode: { id: string; position: { x: number; y: number }; width?: number; height?: number; measured?: { width?: number; height?: number } }) => {
      // Group container drag — translate captured members as the
      // group moves. Members were snapshotted at drag start; we
      // apply the same delta to all of them so the contents
      // move rigidly with the container.
      if (draggedNode.id.startsWith('group_')) {
        const ref = groupDragRef.current;
        if (ref && ref.groupId === draggedNode.id) {
          const dx = draggedNode.position.x - ref.groupStart.x;
          const dy = draggedNode.position.y - ref.groupStart.y;
          setNodes((nds) =>
            nds.map((n) => {
              const member = ref.members.find((m) => m.id === n.id);
              if (!member) return n;
              return { ...n, position: { x: member.startX + dx, y: member.startY + dy } };
            }),
          );
        }
        if (smartGuides.length > 0) setSmartGuides([]);
        return;
      }

      // Multi-node drag — React Flow doesn't automatically
      // translate sibling selected nodes when the user drags one
      // of them, so we do it manually using the snapshot
      // captured in `onNodeDragStartGuides`. Apply the same
      // (dragged.position - draggedStart) delta to each sibling.
      const mref = multiDragRef.current;
      if (mref && mref.draggedId === draggedNode.id && mref.siblings.length > 0) {
        const dx = draggedNode.position.x - mref.draggedStart.x;
        const dy = draggedNode.position.y - mref.draggedStart.y;
        setNodes((nds) =>
          nds.map((n) => {
            const sibling = mref.siblings.find((s) => s.id === n.id);
            if (!sibling) return n;
            return { ...n, position: { x: sibling.startX + dx, y: sibling.startY + dy } };
          }),
        );
        // Skip smart-guides for group drags — alignment between
        // siblings moving in lockstep is noise.
        if (smartGuides.length > 0) setSmartGuides([]);
        return;
      }
      const others = collectBBoxes(draggedNode.id);
      if (others.length === 0) {
        if (smartGuides.length > 0) setSmartGuides([]);
        return;
      }
      const dw = draggedNode.width ?? draggedNode.measured?.width ?? 220;
      const dh = draggedNode.height ?? draggedNode.measured?.height ?? 100;
      const result = computeSmartGuides(
        { id: draggedNode.id, x: draggedNode.position.x, y: draggedNode.position.y, width: dw, height: dh },
        others,
      );
      setSmartGuides(result.guides);
    },
    [collectBBoxes, smartGuides.length, nodes, setNodes],
  );

  // Group container drag — onDragStart captures the group's
  // initial bbox and every state whose center lies inside it.
  // During onDrag we translate those captured members by the
  // same (group.position - groupStart) delta so the contents
  // move rigidly with the container. On drag-stop we persist
  // member positions to the diagram JSON. The ref pattern keeps
  // the drag loop allocation-free.
  const onNodeDragStartGuides = useCallback(
    (_: unknown, dragged: { id: string; position: { x: number; y: number }; width?: number; height?: number; measured?: { width?: number; height?: number } }) => {
      // Clear stale guides at drag start in case the previous drag
      // left any (defensive — the drag-stop handler also clears).
      setSmartGuides([]);

      // Multi-node drag setup — snapshot every OTHER currently-
      // selected user state so we can translate them in lockstep
      // during onNodeDrag. Skip when only the dragged node is
      // selected (single-node drag, no special handling needed).
      // Group containers do their own snapshot below.
      if (!dragged.id.startsWith('group_')) {
        const siblings = nodes
          .filter((n) => n.selected && n.id !== dragged.id)
          .filter((n) => !n.id.startsWith('__') && !n.id.startsWith('group_'))
          .map((n) => ({ id: n.id, startX: n.position.x, startY: n.position.y }));
        if (siblings.length > 0) {
          multiDragRef.current = {
            draggedId: dragged.id,
            draggedStart: { x: dragged.position.x, y: dragged.position.y },
            siblings,
          };
        }
      }

      // Group container drag — snapshot members so we can move
      // them as a unit during onDrag.
      if (dragged.id.startsWith('group_')) {
        const groupNode = nodes.find((n) => n.id === dragged.id);
        if (!groupNode) return;
        const gx = groupNode.position.x;
        const gy = groupNode.position.y;
        const gw = groupNode.width ?? groupNode.measured?.width ?? 200;
        const gh = groupNode.height ?? groupNode.measured?.height ?? 120;
        const members: Array<{ id: string; startX: number; startY: number }> = [];
        for (const n of nodes) {
          if (n.id === dragged.id) continue;
          // Skip pseudo + other groups (groups shouldn't nest
          // until we model that explicitly).
          if (n.id.startsWith('__') || n.id.startsWith('group_')) continue;
          const nw = n.width ?? n.measured?.width ?? 220;
          const nh = n.height ?? n.measured?.height ?? 100;
          const cx = n.position.x + nw / 2;
          const cy = n.position.y + nh / 2;
          // Membership = center inside the group's bounding rect
          // *at drag start*. We don't update membership while the
          // drag is in progress so a member doesn't pop out mid-drag.
          if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
            members.push({ id: n.id, startX: n.position.x, startY: n.position.y });
          }
        }
        groupDragRef.current = {
          groupId: dragged.id,
          groupStart: { x: gx, y: gy },
          members,
        };
      }
    },
    [nodes],
  );

  const onNodeDragStopClearGuides = useCallback(() => {
    setSmartGuides([]);

    // Persist final positions for any tracked drag pattern —
    // both group-drag and multi-drag funnel through the same
    // diagram-write path so the structure on disk stays
    // consistent. The dragged node itself is already persisted
    // by `onNodeDragStop`; here we only persist its passengers.
    const idsToPersist: string[] = [];
    if (groupDragRef.current) {
      for (const m of groupDragRef.current.members) idsToPersist.push(m.id);
    }
    if (multiDragRef.current) {
      for (const s of multiDragRef.current.siblings) idsToPersist.push(s.id);
    }
    if (idsToPersist.length > 0) {
      const finalPositions = new Map<string, { x: number; y: number }>();
      for (const id of idsToPersist) {
        const n = nodes.find((nn) => nn.id === id);
        if (n) finalPositions.set(id, n.position);
      }
      updateDiagram((draft: Record<string, unknown>) => {
        const prev = draft.nodePos;
        const nodePos =
          prev && typeof prev === 'object' && !Array.isArray(prev)
            ? { ...(prev as Record<string, Record<string, unknown>>) }
            : {};
        for (const [id, pos] of finalPositions) {
          const existing = nodePos[id] ?? {};
          nodePos[id] = {
            ...existing,
            x: Math.round(pos.x),
            y: Math.round(pos.y),
          };
        }
        draft.nodePos = nodePos;
      });
    }
    groupDragRef.current = null;
    multiDragRef.current = null;
  }, [nodes, updateDiagram]);

  // ─── Multi-select bulk actions ─────────────────────────────────────
  //
  // Selected user states (excludes the synthetic start / workflow-
  // level pseudo nodes — those can't be bulk-deleted or duplicated).
  // Recomputed whenever the React Flow nodes array changes; React's
  // strict equality on the filtered ids keeps the BulkActionsToolbar
  // from re-rendering on unrelated node updates.
  const bulkSelectedIds = useMemo(() => {
    return nodes
      .filter((n) => n.selected && !n.id.startsWith('__start__') && !n.id.startsWith('__wf_'))
      .map((n) => n.id);
  }, [nodes]);

  const handleBulkDelete = useCallback(() => {
    for (const id of bulkSelectedIds) removeState(id);
  }, [bulkSelectedIds, removeState]);

  const handleBulkDuplicate = useCallback(() => {
    // Offset duplicates +40,+40 from the source. Use the diagram
    // for absolute coords so we don't depend on React Flow's
    // internal node objects.
    const positions = toDiagramData(diagramJson).nodePos;
    for (const id of bulkSelectedIds) {
      const pos = positions[id] || { x: 200, y: 200 };
      duplicateState(id, { x: (pos.x ?? 200) + 40, y: (pos.y ?? 200) + 40 });
    }
  }, [bulkSelectedIds, diagramJson, duplicateState]);

  // Group the currently-selected user states inside a new
  // `groupNode` container. We compute the tight bounding box of
  // the selection, pad it slightly so the container "hugs" the
  // cluster without being claustrophobic, and append a new
  // entry to `diagram.groups`. The states themselves don't move
  // — the container just slides behind them via `zIndex: -1`.
  // ─── Export PNG / SVG + Presentation Mode ─────────────────────────
  const handleExportPng = useCallback(async () => {
    const viewport = canvasWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    const wrapper = canvasWrapperRef.current;
    if (!viewport || !wrapper) return;
    try {
      await exportCanvasPng({ nodes, viewport, wrapper, fileNameBase: 'workflow' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('PNG export failed', err);
    }
  }, [nodes]);

  const handleExportSvg = useCallback(async () => {
    const viewport = canvasWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    const wrapper = canvasWrapperRef.current;
    if (!viewport || !wrapper) return;
    try {
      await exportCanvasSvg({ nodes, viewport, wrapper, fileNameBase: 'workflow' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('SVG export failed', err);
    }
  }, [nodes]);

  // Presentation Mode — fullscreens ONLY the canvas wrapper, so
  // the browser/Electron natively hides every chrome element
  // (sidebar, activity bar, tabs, status bar, menubar) without
  // any per-element CSS gymnastics. The native Escape behavior of
  // the Fullscreen API exits cleanly back to the windowed view.
  //
  // We also set `data-presentation="true"` on the body so the CSS
  // can hide React Flow's *own* chrome (minimap, controls, panels)
  // during the fullscreen session — those live inside the
  // wrapper, so they'd otherwise still render.
  //
  // The `fullscreenchange` listener auto-cleans the data attr
  // when the user exits, regardless of HOW they exit (Escape,
  // F11, or a Fullscreen API call from elsewhere).
  const handleEnterPresentation = useCallback(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    document.body.setAttribute('data-presentation', 'true');

    const onFsChange = () => {
      if (!document.fullscreenElement) {
        document.body.removeAttribute('data-presentation');
        document.removeEventListener('fullscreenchange', onFsChange);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);

    void wrapper.requestFullscreen?.().catch(() => {
      // Fullscreen rejection (e.g. permission denied) — fall
      // back to CSS-only presentation: the host shell hides its
      // chrome via the data attribute, but the window stays
      // windowed. Escape still cleans up via the same handler.
      document.removeEventListener('fullscreenchange', onFsChange);
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          document.body.removeAttribute('data-presentation');
          window.removeEventListener('keydown', onEsc);
        }
      };
      window.addEventListener('keydown', onEsc);
    });
  }, []);

  const handleBulkGroup = useCallback(() => {
    if (bulkSelectedIds.length < 1) return;
    const selectedNodesData = nodes.filter((n) => bulkSelectedIds.includes(n.id));
    if (selectedNodesData.length === 0) return;

    const padding = 24;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of selectedNodesData) {
      const w = n.width ?? n.measured?.width ?? 220;
      const h = n.height ?? n.measured?.height ?? 100;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const id = `group_${Math.random().toString(36).slice(2, 10)}`;
    updateDiagram((draft: Record<string, unknown>) => {
      const list = (draft.groups as Array<Record<string, unknown>> | undefined) ?? [];
      list.push({
        id,
        x: Math.round(minX - padding),
        y: Math.round(minY - padding - 16), // extra room for the label chip
        width: Math.round(maxX - minX + padding * 2),
        height: Math.round(maxY - minY + padding * 2 + 16),
        label: 'New group',
        color: 'slate',
      });
      draft.groups = list;
    });
  }, [bulkSelectedIds, nodes, updateDiagram]);

  // ─── SYNC: workflowJson/diagramJson → ReactFlow nodes/edges ───
  //
  // We REPLACE the entire nodes array whenever the workflow JSON
  // or diagram JSON changes (state add/remove, note edit, group
  // tweak, etc). The `computedNodes` produced by Conversion.ts
  // are freshly minted plain objects with no React-Flow runtime
  // flags — including no `selected: true`. Without explicit
  // carry-over the visual selection would reset on every diagram
  // mutation, which broke the sticky-note toolbar (`patchNote`
  // updates the note → diagram changes → sync replaces nodes →
  // note loses `selected: true` → NodeToolbar's `isVisible`
  // flips back to false → the user's mid-interaction click
  // happens "outside" the toolbar that vanished a frame ago).
  //
  // The fix is to copy the previous selection set forward when
  // we rebuild — same for edges.
  useEffect(() => {
    setNodes((prevNodes) => {
      const selectedIds = new Set(prevNodes.filter((n) => n.selected).map((n) => n.id));
      if (selectedIds.size === 0) return computedNodes;
      return computedNodes.map((n) => (selectedIds.has(n.id) ? { ...n, selected: true } : n));
    });
    setEdges((prevEdges) => {
      const selectedIds = new Set(prevEdges.filter((e) => e.selected).map((e) => e.id));
      if (selectedIds.size === 0) return computedEdges;
      return computedEdges.map((e) => (selectedIds.has(e.id) ? { ...e, selected: true } : e));
    });
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  // Auto-layout on first load if no diagram positions exist
  useEffect(() => {
    if (needsLayout && !autoLayoutDone.current && computedNodes.length > 0) {
      autoLayoutDone.current = true;
      layoutFlow(computedNodes, computedEdges, {
        algorithm: settings.algorithm,
        direction: settings.direction,
      }).then((layoutedNodes) => {
        setNodes(layoutedNodes);
        const positions = reactFlowToPositions(layoutedNodes);
        updateDiagram((draft: Record<string, unknown>) => {
          draft.nodePos = positions.nodePos;
        });
        markClean();
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    }
  }, [needsLayout, computedNodes, computedEdges, setNodes, updateDiagram, fitView, markClean, settings.algorithm, settings.direction]);

  // ─── Keep edge sourceHandle/targetHandle in sync with node positions
  // so the React Flow reconnect updater circle appears on the correct side ───
  useEffect(() => {
    setEdges((eds) => {
      let changed = false;
      const next = eds.map((edge) => {
        if (edge.source === edge.target) return edge;
        const sn = getInternalNode(edge.source);
        const tn = getInternalNode(edge.target);
        if (!sn || !tn) return edge;

        const { sourceHandle, targetHandle } = getFloatingHandleIds(sn, tn);
        if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) return edge;
        changed = true;
        return { ...edge, sourceHandle, targetHandle };
      });
      return changed ? next : eds;
    });
  }, [nodes, setEdges, getInternalNode]);

  // ─── Node changes (position, selection, resize, etc.) ───
  //
  // We intercept `position` changes during an active drag to apply
  // Snap-to-Node magnetism: when the dragged node's bbox aligns
  // with another node's edge within the 6px threshold, the
  // position is nudged to make the alignment exact. The user feels
  // a soft "click into place" without ever having to be pixel-
  // perfect.
  //
  // Snapping only activates while `change.dragging === true` so
  // programmatic position updates (e.g. auto-layout) don't get
  // mangled. The 'dimensions' branch below is unchanged.
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Detect a multi-node drag. React Flow emits one `position`
      // change per selected node when the user drags a group; if
      // we ran Snap-to-Node independently on each, the snap
      // delta for one node would shift it relative to the others
      // and the cluster would deform on drop. Disable snap (and
      // smart guides — see onNodeDrag) for any change-set that
      // carries more than a single dragging position update.
      const draggingPositionChanges = changes.filter(
        (c) => c.type === 'position' && c.dragging,
      );
      const isMultiDrag = draggingPositionChanges.length > 1;

      const snappedChanges = changes.map((change) => {
        if (
          change.type !== 'position' ||
          !change.dragging ||
          !change.position ||
          isMultiDrag // preserve relative positions on group drag
        ) {
          return change;
        }
        const draggedNode = nodes.find((n) => n.id === change.id);
        if (!draggedNode) return change;
        const w = draggedNode.width ?? draggedNode.measured?.width ?? 220;
        const h = draggedNode.height ?? draggedNode.measured?.height ?? 100;
        const others = collectBBoxes(change.id);
        if (others.length === 0) return change;
        const { snapDelta } = computeSmartGuides(
          { id: change.id, x: change.position.x, y: change.position.y, width: w, height: h },
          others,
        );
        if (snapDelta.x === 0 && snapDelta.y === 0) return change;
        return {
          ...change,
          position: {
            x: change.position.x + snapDelta.x,
            y: change.position.y + snapDelta.y,
          },
        };
      });

      onNodesChange(snappedChanges);

      for (const change of snappedChanges) {
        if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
          const nodeId = change.id;
          const { width, height } = change.dimensions;
          updateDiagram((draft: Record<string, unknown>) => {
            // Notes and groups live in their own arrays, NOT in
            // `nodePos`. Without this dispatch the resize handles
            // appeared to do nothing because the new width/height
            // got written into a phantom nodePos entry that the
            // next render ignored (Conversion.ts reads from
            // `draft.notes` / `draft.groups`).
            if (nodeId.startsWith('forge_note_')) {
              const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
              const idx = list.findIndex((n) => (n as { id?: string }).id === nodeId);
              if (idx >= 0) {
                list[idx] = {
                  ...list[idx],
                  width: Math.round(width),
                  height: Math.round(height),
                };
                draft.notes = list;
              }
              return;
            }
            if (nodeId.startsWith('group_')) {
              const list = (draft.groups as Array<Record<string, unknown>> | undefined) ?? [];
              const idx = list.findIndex((g) => (g as { id?: string }).id === nodeId);
              if (idx >= 0) {
                list[idx] = {
                  ...list[idx],
                  width: Math.round(width),
                  height: Math.round(height),
                };
                draft.groups = list;
              }
              return;
            }
            const prev = draft.nodePos;
            const nodePos =
              prev && typeof prev === 'object' && !Array.isArray(prev)
                ? { ...(prev as Record<string, Record<string, unknown>>) }
                : {};
            const existing = nodePos[nodeId] ?? {};
            nodePos[nodeId] = {
              ...existing,
              width: Math.round(width),
              height: Math.round(height),
            };
            draft.nodePos = nodePos;
          });
        }
      }
    },
    [onNodesChange, updateDiagram, nodes, collectBBoxes],
  );

  // ─── Node drag → update diagram positions ───
  const onNodeDragStop = useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) => {
      updateDiagram((draft: Record<string, unknown>) => {
        // Sticky notes / groups live in `draft.notes` / `draft.groups`,
        // not `draft.nodePos`. We dispatch on the id prefix because
        // react-flow doesn't surface the node type into the drag
        // callback.
        if (node.id.startsWith('forge_note_')) {
          const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
          const idx = list.findIndex((n) => (n as { id?: string }).id === node.id);
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            };
            draft.notes = list;
          }
          return;
        }
        if (node.id.startsWith('group_')) {
          const list = (draft.groups as Array<Record<string, unknown>> | undefined) ?? [];
          const idx = list.findIndex((g) => (g as { id?: string }).id === node.id);
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            };
            draft.groups = list;
          }
          return;
        }
        const prev = draft.nodePos;
        const nodePos =
          prev && typeof prev === 'object' && !Array.isArray(prev)
            ? { ...(prev as Record<string, Record<string, unknown>>) }
            : {};
        const existing = nodePos[node.id] ?? {};
        nodePos[node.id] = {
          ...existing,
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        };
        draft.nodePos = nodePos;
      });
    },
    [updateDiagram],
  );

  // ─── Connection validation: block edges from final states ───
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      if (!connection.source) return false;
      const attrs = (workflowJson as any)?.attributes;
      const states: any[] = attrs?.states ?? [];
      const sourceState = states.find((s: any) => s.key === connection.source);
      if (sourceState?.stateType === 3) return false;
      return true;
    },
    [workflowJson],
  );

  // ─── Connect: Create transition in workflowJson ───
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      addTransition(connection.source, connection.target, 0);
    },
    [addTransition],
  );

  // ─── Reconnect: Drag edge endpoint to a different node ───
  const reconnectSuccessful = useRef(true);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectSuccessful.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));

      const transitionKey = (oldEdge.data as Record<string, unknown> | undefined)?.transitionKey as string | undefined;
      const newTarget = newConnection.target;
      if (transitionKey && oldEdge.source && newTarget) {
        reconnectTransition(oldEdge.source, transitionKey, newTarget);
      }
    },
    [setEdges, reconnectTransition],
  );

  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false;
  }, []);

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, _edge: Edge) => {
      // Drop-on-empty → revert: when the user drags an edge endpoint
      // and releases it on empty canvas (no valid node under cursor),
      // we do nothing. React Flow's drag preview disappears and the
      // edge stays bound to its original source/target — visually a
      // "snap back" to the starting position. The user explicitly
      // asked us NOT to delete on empty-drop. Deletion is still
      // available through the edge context-menu and (future) keyboard
      // Backspace/Delete.
      //
      // We still reset the success ref so the next reconnect gesture
      // starts from a clean slate.
      reconnectSuccessful.current = true;
    },
    [],
  );

  // ─── Selection ───
  const onNodeClick = useCallback(
    (_: unknown, node: { id: string }) => {
      if (node.id.startsWith('__wf_')) {
        setContextMenu(null);
        return;
      }
      if (node.id.startsWith('forge_note_')) {
        setContextMenu(null);
        return;
      }
      setSelectedNode(node.id);
      setContextMenu(null);
    },
    [setSelectedNode],
  );

  const onEdgeClick = useCallback(
    (_: unknown, edge: { id: string }) => {
      setSelectedEdge(edge.id);
      setContextMenu(null);
    },
    [setSelectedEdge],
  );

  const { setEditingNoteId } = useNoteEditing();

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: { id: string }) => {
      if (node.id.startsWith('__wf_')) {
        const kind = node.id.replace(/^__wf_/, '').replace(/__$/, '').replace(/^shared_.*/, 'sharedTransitions');
        onOpenWorkflowSettings?.(kind);
        return;
      }
      // Sticky note double-click → enter inline edit mode. We
      // dispatch the flag through context (consumed by NoteNode)
      // because React Flow finishes its own selection update
      // BEFORE this callback fires, so we don't fight with its
      // selection state machine. The previous approach attached
      // `onDoubleClick` directly to the NoteNode wrapper, which
      // caused React Flow to interpret the two underlying
      // mousedown / click events as separate toggling clicks —
      // the side inspector flickered open/closed and edit mode
      // never engaged.
      if (node.id.startsWith('forge_note_')) {
        setEditingNoteId(node.id);
      }
    },
    [onOpenWorkflowSettings, setEditingNoteId],
  );

  const [toolbarCloseSignal, setToolbarCloseSignal] = useState(0);

  // ─── Canvas Search: spotlight lifecycle ───
  const clearSpotlight = useCallback(() => {
    if (spotlightTimerRef.current) {
      clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        if ((n.data as Record<string, unknown> | undefined)?.spotlight) {
          changed = true;
          const { spotlight: _, ...rest } = n.data as Record<string, unknown>;
          return { ...n, data: rest };
        }
        return n;
      });
      return changed ? next : nds;
    });
    setEdges((eds) => {
      let changed = false;
      const next = eds.map((e) => {
        if ((e.data as Record<string, unknown> | undefined)?.spotlight) {
          changed = true;
          const { spotlight: _, ...rest } = (e.data || {}) as Record<string, unknown>;
          return { ...e, data: rest };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [setNodes, setEdges]);

  useEffect(() => {
    return () => {
      if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current);
      if (fitViewFollowUpRef.current) clearTimeout(fitViewFollowUpRef.current);
    };
  }, []);

  const onPaneClick = useCallback(
    (event?: React.MouseEvent) => {
      setContextMenu(null);
      setToolbarCloseSignal((s) => s + 1);
      clearSpotlight();
      // Only clear our workflow store selection if the click
      // truly landed on the React Flow pane element. Some
      // portaled UI (NodeToolbar, NodeResizer handles, etc.)
      // sits inside the React Flow root and an event there can
      // sometimes still surface in `onPaneClick`; we must NOT
      // treat those as pane clicks or the user loses their
      // selection mid-interaction with the floating toolbar.
      const target = event?.target as HTMLElement | undefined;
      if (target) {
        const isActualPane =
          target.classList?.contains('react-flow__pane') ||
          target.closest?.('.react-flow__pane') !== null;
        const isInsidePortaledUi =
          target.closest?.('.react-flow__node-toolbar') !== null ||
          target.closest?.('.react-flow__resize-control') !== null;
        if (!isActualPane || isInsidePortaledUi) return;
      }
      setSelectedNode(null);
      setSelectedEdge(null);
    },
    [clearSpotlight, setSelectedNode, setSelectedEdge],
  );

  // Sticky-note creation — invoked from the pane context menu
  // ("Right-click empty canvas → Sticky Note"). Drops a 200×80
  // note at the right-click flow coordinate. Notes get a
  // `forge_note_<short-uuid>` id so they can never collide with
  // workflow state keys.
  const addNoteAt = useCallback(
    (flowPos: { x: number; y: number }) => {
      const id = `forge_note_${Math.random().toString(36).slice(2, 10)}`;
      const NOTE_W = 200;
      const NOTE_H = 80;
      updateDiagram((draft: Record<string, unknown>) => {
        const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
        list.push({
          id,
          x: Math.round(flowPos.x - NOTE_W / 2),
          y: Math.round(flowPos.y - NOTE_H / 2),
          width: NOTE_W,
          height: NOTE_H,
          text: '',
          color: 'yellow',
        });
        draft.notes = list;
      });
    },
    [updateDiagram],
  );

  // ─── Context Menus ───
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        type: 'pane',
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    if (node.id === '__start__') return;
    if (node.id.startsWith('forge_note_')) return;
    if (node.id.startsWith('__wf_')) {
      const kind = node.id.replace(/^__wf_/, '').replace(/__$/, '').replace(/^shared_.*/, 'sharedTransitions');
      setContextMenu({
        type: 'wfNode',
        screenX: event.clientX,
        screenY: event.clientY,
        nodeId: node.id,
        sectionKind: kind,
      });
      return;
    }
    setContextMenu({
      type: 'node',
      screenX: event.clientX,
      screenY: event.clientY,
      nodeId: node.id,
    });
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: { id: string; source: string; data?: { transitionKey?: string } }) => {
      event.preventDefault();
      const transitionKey = edge.data?.transitionKey ?? edge.id;
      setContextMenu({
        type: 'edge',
        screenX: event.clientX,
        screenY: event.clientY,
        sourceStateKey: edge.source,
        transitionKey,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ─── Delete with keyboard ───
  const onNodesDelete = useCallback(
    (deletedNodes: Array<{ id: string }>) => {
      for (const node of deletedNodes) {
        if (node.id === '__start__' || node.id.startsWith('__wf_')) continue;
        removeState(node.id);
      }
    },
    [removeState],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Array<{ id: string; source: string; data?: { transitionKey?: string } }>) => {
      for (const edge of deletedEdges) {
        const transitionKey = edge.data?.transitionKey;
        if (transitionKey && edge.source !== '__start__') {
          removeTransition(edge.source, transitionKey);
        }
      }
    },
    [removeTransition],
  );

  // ─── Auto Layout ───
  const handleAutoLayout = useCallback(async () => {
    const layoutedNodes = await layoutFlow(nodes, edges, {
      algorithm: settings.algorithm,
      direction: settings.direction,
    });
    setNodes(layoutedNodes);
    const positions = reactFlowToPositions(layoutedNodes);
    updateDiagram((draft: Record<string, unknown>) => {
      draft.nodePos = positions.nodePos;
    });
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, setNodes, updateDiagram, fitView, settings.algorithm, settings.direction]);

  // ─── Add state from toolbar (center of viewport) ───
  const handleToolbarAddState = useCallback(
    (stateType: number, subType: number) => {
      const vp = getViewport();
      // Approximate viewport center in flow coordinates
      const centerX = (-vp.x + 600) / vp.zoom;
      const centerY = (-vp.y + 300) / vp.zoom;
      addState(stateType, subType, { x: centerX, y: centerY });
    },
    [addState, getViewport],
  );

  // ─── Add state from context menu (at click position) ───
  const handleContextMenuAddState = useCallback(
    (stateType: number, subType: number, position: { x: number; y: number }) => {
      addState(stateType, subType, position);
    },
    [addState],
  );

  // ─── Duplicate state ───
  const handleDuplicateState = useCallback(
    (key: string) => {
      const nodePos = toDiagramData(diagramJson).nodePos[key];
      const pos = nodePos || { x: 200, y: 200 };
      duplicateState(key, pos);
    },
    [duplicateState, diagramJson],
  );

  // ─── Canvas keyboard shortcuts ─────────────────────────────────────
  //   - Cmd/Ctrl+F   → open search spotlight
  //   - Tab          → cycle to next focusable state node
  //   - Shift+Tab    → cycle to previous state node
  //   - Enter        → "open" the currently selected node (mirror of
  //                    double-click; lets users hand off to the
  //                    inspector without reaching for the mouse)
  //
  // Tab cycles only through user-owned state nodes; the synthetic
  // `__start__` and `__wf_*` pseudo-nodes are skipped because they
  // don't open editors. The list is recomputed each press because
  // node insertions/deletions can change the cycle order.
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      // Don't hijack keystrokes that originate inside an input,
      // textarea, contenteditable, or Monaco editor.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isFormField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isFormField) return;

      // Search spotlight.
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
        return;
      }

      // `?` (no modifier) → open keyboard shortcuts overlay.
      // We accept `Shift+/` (which produces `?` on US layouts)
      // and bare `?` to cover non-US keyboards where the
      // character lands directly.
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Currently-selected node is whichever node has React Flow's
      // `selected: true` flag. We don't pull from the workflow store
      // because `setSelectedNode` there only writes — the canonical
      // selection state lives on the React Flow nodes themselves.
      const currentSelectedId = nodes.find((n) => n.selected)?.id;

      // Tab cycling.
      if (e.key === 'Tab') {
        const ids = nodes
          .filter((n) => !n.id.startsWith('__start__') && !n.id.startsWith('__wf_'))
          .map((n) => n.id);
        if (ids.length === 0) return;
        e.preventDefault();
        const currentIdx = currentSelectedId ? ids.findIndex((id) => id === currentSelectedId) : -1;
        let nextIdx: number;
        if (currentIdx === -1) {
          nextIdx = e.shiftKey ? ids.length - 1 : 0;
        } else {
          nextIdx = e.shiftKey
            ? (currentIdx - 1 + ids.length) % ids.length
            : (currentIdx + 1) % ids.length;
        }
        const nextId = ids[nextIdx];
        setSelectedNode(nextId);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nextId })));
        return;
      }

      // Enter — invoke the same handler as a double-click on the
      // selected node (opens the inspector / sub-flow).
      if (e.key === 'Enter' && currentSelectedId) {
        const node = nodes.find((n) => n.id === currentSelectedId);
        if (node) {
          e.preventDefault();
          onNodeDoubleClick(e as unknown as React.MouseEvent, node);
        }
      }
    };

    el.addEventListener('keydown', handler, true);
    return () => el.removeEventListener('keydown', handler, true);
  }, [nodes, setSelectedNode, setNodes, onNodeDoubleClick]);

  const applySpotlight = useCallback(
    (kind: 'node' | 'edge', id: string) => {
      clearSpotlight();
      if (kind === 'node') {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, spotlight: true }, selected: true } : { ...n, selected: false },
          ),
        );
      } else {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, spotlight: true }, selected: true } : { ...e, selected: false },
          ),
        );
      }
      spotlightTimerRef.current = setTimeout(clearSpotlight, 1500);
    },
    [clearSpotlight, setNodes, setEdges],
  );

  const handleSearchSelectState = useCallback(
    (nodeId: string) => {
      setSelectedNode(nodeId);
      fitView({ nodes: [{ id: nodeId }], padding: 0.3, duration: 400 });
      if (fitViewFollowUpRef.current) clearTimeout(fitViewFollowUpRef.current);
      fitViewFollowUpRef.current = setTimeout(() => applySpotlight('node', nodeId), 420);
    },
    [setSelectedNode, fitView, applySpotlight],
  );

  const handleSearchSelectTransition = useCallback(
    (edgeId: string, sourceKey: string, targetKey: string) => {
      setSelectedEdge(edgeId);
      const nodeIds = [{ id: sourceKey }];
      if (targetKey && targetKey !== sourceKey) {
        nodeIds.push({ id: targetKey });
      }
      fitView({ nodes: nodeIds, padding: 0.3, duration: 400 });
      if (fitViewFollowUpRef.current) clearTimeout(fitViewFollowUpRef.current);
      fitViewFollowUpRef.current = setTimeout(() => applySpotlight('edge', edgeId), 420);
    },
    [setSelectedEdge, fitView, applySpotlight],
  );

  // Zoom-tier bookkeeping — React Flow exposes its viewport via
  // `useStore` (the *xyflow* store, not our app store). We watch
  // the zoom scalar and map it to a coarse tier so CSS can react.
  // The `--rf-counter-scale` variable is the inverse zoom, used by
  // label-counter-scaling so labels keep a fixed screen size.
  const reactFlowZoom = useReactFlowStore((s) => s.transform[2]);
  const zoomTier = reactFlowZoom < 0.5 ? 'sm' : reactFlowZoom < 1.4 ? 'md' : 'lg';
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    el.style.setProperty('--rf-zoom', String(reactFlowZoom));
    el.style.setProperty('--rf-counter-scale', String(1 / reactFlowZoom));
  }, [reactFlowZoom]);

  const backgroundVariant: BackgroundVariant | null =
    settings.backgroundStyle === 'dots'
      ? BackgroundVariant.Dots
      : settings.backgroundStyle === 'lines'
        ? BackgroundVariant.Lines
        : null;
  const backgroundGap = resolveBackgroundGap(settings.backgroundDensity);
  const arrowMarkerSize = resolveArrowSize(settings.arrowSize);

  return (
    <div
      ref={canvasWrapperRef}
      // `relative` provides the positioning context for
      // canvas-internal absolute overlays (SmartGuidesOverlay,
      // SaveStatusIndicator). Without it those overlays would pin
      // to the viewport and overlap host chrome (window title bar,
      // tab strip, save buttons).
      className="relative h-full w-full"
      tabIndex={-1}
      // Several attributes feed canvas-overrides.css:
      //   data-focus-mode      → opacity dim of non-selected items
      //   data-zoom-tier       → coarse zoom bucket (sm/md/lg)
      //   data-label-zoom-hide → hide labels when zoom is in `sm` tier
      //   data-non-scaling     → opt-in `vector-effect: non-scaling-stroke`
      //   data-counter-scale   → labels keep fixed on-screen size
      //   data-pulse-mode      → which pulse animation pattern is active;
      //                          gates the source-node sonar ring so
      //                          users see the wave's origin clearly
      data-focus-mode={settings.focusMode ? 'true' : 'false'}
      data-zoom-tier={zoomTier}
      data-label-zoom-hide={settings.labelZoomHidden ? 'true' : 'false'}
      data-non-scaling={settings.nonScalingStrokes ? 'true' : 'false'}
      data-counter-scale={settings.counterScaleLabels ? 'true' : 'false'}
      data-pulse-mode={settings.pulseAnimation}
    >
      {/*
       * Document-scoped SVG `<defs>` for arrow markers. One per
       * trigger-type variant; every TransitionEdge references these
       * via `url(#vf-marker-…)` instead of generating its own defs.
       * See `SharedEdgeMarkers.tsx` for rationale.
       */}
      <SharedEdgeMarkers size={arrowMarkerSize} />
      {/*
       * Smart Guides overlay — purple dashed lines that appear
       * while the user drags a state to indicate alignment with
       * neighboring nodes' edges. The overlay reads React Flow's
       * viewport transform internally so it shares the same
       * coordinate space without us threading viewport props.
       */}
      <SmartGuidesOverlay guides={smartGuides} />
      {/*
       * Bulk-actions toolbar — appears when the user has multiple
       * states selected (via the rubber-band drag in Select mode
       * or Cmd/Shift+click multi-add). Hidden when count < 2.
       */}
      <BulkActionsToolbar
        selectedCount={bulkSelectedIds.length}
        onDelete={handleBulkDelete}
        onDuplicate={handleBulkDuplicate}
        onGroup={handleBulkGroup}
      />
      {/* Keyboard shortcuts overlay — opened via `?` key. Renders
       * as a body-level modal so it floats above all canvas chrome
       * and Escape captures cleanly. */}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      {/* Empty-canvas guide — guided placeholder shown when the
       * workflow has zero user states. Clicking "Add Initial
       * State" triggers the same flow as the toolbar's first
       * dropdown entry (stateType=1, subType=0). */}
      <EmptyCanvasGuide
        stateCount={
          nodes.filter(
            (n) => !n.id.startsWith('__') && !n.id.startsWith('forge_note_') && !n.id.startsWith('group_'),
          ).length
        }
        onAddState={() => handleToolbarAddState(1, 0)}
      />
      {/* Save status chip — top-right pill, tracks dirty/saved
       * state from the workflow store. Saving + error props are
       * left optional for future wiring from the save layer. */}
      <SaveStatusIndicator isDirty={isDirty} lastSavedAt={lastSavedAt} />
      {/* Workflow lint + pattern detection. Lint runs every
       * render — small workflows it's free; for very large
       * workflows we could memoize on workflowJson, but in
       * practice the linter is O(N+E) and well below 1ms. */}
      <WorkflowInsights
        findings={lintWorkflow(toVnextWorkflow(workflowJson))}
        patterns={detectPatterns(toVnextWorkflow(workflowJson))}
        onFocusState={(stateKey) => {
          fitView({ nodes: [{ id: stateKey }], padding: 0.3, duration: 400 });
          applySpotlight('node', stateKey);
        }}
      />
      <ReactFlow
        // `decoratedNodes` / `decoratedEdges` are the same nodes/edges
        // arrays with optional pulse classNames attached when a
        // selection-pulse animation is active. When no pulse is
        // happening they're identity-equal to the underlying arrays.
        nodes={decoratedNodes}
        edges={decoratedEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        reconnectRadius={25}
        /*
         * `connectionRadius` controls how far from a handle a pointer
         * release still counts as a "drop on that handle". Default 20px
         * forces users to land on (or right next to) one of the four
         * edge dots. Bumping it to 220 means the pointer can land
         * anywhere on the target node's body and React Flow will pick
         * the closest handle automatically — same UX as Easy Connect's
         * "drag onto the node, not the dot" behavior.
         */
        connectionRadius={220}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        // Smart Guides wiring:
        //   - onNodeDragStart → reset stale guide state
        //   - onNodeDrag      → compute live alignment with neighbors
        //   - onNodeDragStop  → save position + clear guides
        // The drag-stop handler chains both behaviors so the final
        // position write keeps working alongside guide cleanup.
        onNodeDragStart={onNodeDragStartGuides}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={(event, node) => {
          onNodeDragStop(event, node);
          onNodeDragStopClearGuides();
        }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectionLineComponent={FloatingConnectionLine}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        // Multi-Select policy (no mode toggle needed):
        //   - Plain left-click on a node       → single-select
        //   - Cmd/Ctrl + left-click on a node  → ADD to selection
        //   - Shift + left-drag on empty       → rubber-band rectangle
        //   - Plain left-drag on empty         → pan viewport
        //   - Middle / right drag              → pan (always)
        //
        // `selectNodesOnDrag={false}` is the key fix for group
        // dragging: with the default `true`, mousedown on an
        // already-selected node resets the selection to that node
        // alone *before* drag starts, so the other members of a
        // multi-selection drop off and only the clicked node moves.
        // Turning it off lets the existing selection survive the
        // mousedown — React Flow then translates every selected
        // node by the same delta as the user drags.
        multiSelectionKeyCode={['Meta', 'Control']}
        selectionKeyCode="Shift"
        selectNodesOnDrag={false}
        snapToGrid={settings.snapToGrid}
        snapGrid={[settings.gridSize, settings.gridSize]}
        /*
         * Zoom range — wider on both ends. 0.1 minimum used to let
         * users zoom out so far that label text disappeared and the
         * canvas became a colored blur; 0.3 still shows graph
         * topology but keeps labels legible. 3.5 maximum lets users
         * zoom in for detail inspection (default 2× was too tight
         * when reading long stateKey identifiers).
         */
        minZoom={0.3}
        maxZoom={3.5}
        proOptions={{ hideAttribution: true }}>
        {backgroundVariant !== null && (
          <Background variant={backgroundVariant} gap={backgroundGap} size={1} />
        )}
        <Controls className="border-border! rounded-xl! shadow-sm!" />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="bg-muted-surface/80! border-border! rounded-xl!"
        />
        <Panel position="top-right">
          <CanvasToolbar
            onAddState={handleToolbarAddState}
            onAutoLayout={handleAutoLayout}
            onOpenSearch={() => setSearchOpen(true)}
            workflowSettingsActive={workflowSettingsActive}
            onToggleWorkflowSettings={onToggleWorkflowSettings}
            hasInitialState={hasInitialState}
            closeSignal={toolbarCloseSignal}
            onExportPng={handleExportPng}
            onExportSvg={handleExportSvg}
            onEnterPresentation={handleEnterPresentation}
          />
        </Panel>
      </ReactFlow>

      {/* Context Menus */}
      {contextMenu?.type === 'pane' && (
        <CanvasContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onAddState={handleContextMenuAddState}
          onAddNote={addNoteAt}
          hasInitialState={hasInitialState}
        />
      )}
      {contextMenu?.type === 'node' && (
        <NodeContextMenu
          position={contextMenu}
          nodeId={contextMenu.nodeId}
          onClose={closeContextMenu}
          onDeleteState={removeState}
          onDuplicateState={handleDuplicateState}
          onChangeType={changeStateType}
          hasInitialState={hasInitialState}
        />
      )}
      {contextMenu?.type === 'wfNode' && (
        <WfNodeContextMenu
          position={contextMenu}
          sectionKind={contextMenu.sectionKind}
          onClose={closeContextMenu}
          onOpenSettings={() => {
            onOpenWorkflowSettings?.(contextMenu.sectionKind);
            closeContextMenu();
          }}
        />
      )}
      {contextMenu?.type === 'edge' && (
        <EdgeContextMenu
          position={contextMenu}
          sourceStateKey={contextMenu.sourceStateKey}
          transitionKey={contextMenu.transitionKey}
          onClose={closeContextMenu}
          onDeleteTransition={removeTransition}
          onChangeTrigger={changeTransitionTrigger}
        />
      )}

      <CanvasSearchSpotlight
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectState={handleSearchSelectState}
        onSelectTransition={handleSearchSelectTransition}
        searchItems={searchItems}
      />
    </div>
  );
}

// Wrapper that must be inside ReactFlowProvider — provides CanvasViewSettings context
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <CanvasViewSettingsProvider>
      <NoteEditingProvider>
        <FlowCanvasInner {...props} />
      </NoteEditingProvider>
    </CanvasViewSettingsProvider>
  );
}
