import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
} from './context/CanvasViewSettingsContext';

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

  // ─── SYNC: workflowJson/diagramJson → ReactFlow nodes/edges ───
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
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
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
          const nodeId = change.id;
          const { width, height } = change.dimensions;
          updateDiagram((draft: Record<string, unknown>) => {
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
    [onNodesChange, updateDiagram],
  );

  // ─── Node drag → update diagram positions ───
  const onNodeDragStop = useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) => {
      updateDiagram((draft: Record<string, unknown>) => {
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
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!reconnectSuccessful.current) {
        // Reconnection failed (dropped on empty space) -- keep edge as-is
      }
      reconnectSuccessful.current = true;
    },
    [],
  );

  // ─── Selection ───
  const onNodeClick = useCallback(
    (_: unknown, node: { id: string }) => {
      // Virtual $self nodes: select the edge pointing to them instead
      if (node.id.includes('::$self::')) {
        const targetEdge = edges.find((e) => e.target === node.id);
        if (targetEdge) {
          setSelectedEdge(targetEdge.id);
          setContextMenu(null);
          return;
        }
      }
      // Workflow-level transition nodes: no-op on single click (use right-click menu)
      if (node.id.startsWith('__wf_')) {
        setContextMenu(null);
        return;
      }
      setSelectedNode(node.id);
      setContextMenu(null);
    },
    [setSelectedNode, setSelectedEdge, edges],
  );

  const onEdgeClick = useCallback(
    (_: unknown, edge: { id: string }) => {
      setSelectedEdge(edge.id);
      setContextMenu(null);
    },
    [setSelectedEdge],
  );

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: { id: string }) => {
      if (node.id.startsWith('__wf_')) {
        const kind = node.id.replace(/^__wf_/, '').replace(/__$/, '').replace(/^shared_.*/, 'sharedTransitions');
        onOpenWorkflowSettings?.(kind);
      }
    },
    [onOpenWorkflowSettings],
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

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setToolbarCloseSignal((s) => s + 1);
    clearSpotlight();
  }, [clearSpotlight]);

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

  // ─── Canvas Search: Ctrl/Cmd+F shortcut ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
      }
    };
    const el = canvasWrapperRef.current;
    if (el) {
      el.addEventListener('keydown', handler, true);
      return () => el.removeEventListener('keydown', handler, true);
    }
  }, []);

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

  return (
    <div ref={canvasWrapperRef} className="h-full w-full" tabIndex={-1}>
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        reconnectRadius={25}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
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
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}>
        <Background gap={20} size={1} />
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
          />
        </Panel>
      </ReactFlow>

      {/* Context Menus */}
      {contextMenu?.type === 'pane' && (
        <CanvasContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onAddState={handleContextMenuAddState}
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
      <FlowCanvasInner {...props} />
    </CanvasViewSettingsProvider>
  );
}
