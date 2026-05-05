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
  type OnConnect,
  type OnNodesChange,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './components/nodes';
import { edgeTypes } from './components/edges';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import {
  workflowToReactFlow,
  reactFlowToPositions,
  toDiagramData,
  toVnextWorkflow,
} from './utils/Conversion';
import { layoutFlow } from './utils/Layout';
import { CanvasToolbar } from './components/panels/CanvasToolbar';
import {
  CanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
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
}

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
};

type ContextMenuState =
  | null
  | { type: 'pane'; screenX: number; screenY: number; flowX: number; flowY: number }
  | { type: 'node'; screenX: number; screenY: number; nodeId: string }
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
  } = useWorkflowStore();
  const { fitView, screenToFlowPosition, getViewport } = useReactFlow();
  const { settings } = useCanvasViewSettings();
  const autoLayoutDone = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

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

  // ─── Selection ───
  const onNodeClick = useCallback(
    (_: unknown, node: { id: string }) => {
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

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, [setSelectedNode]);

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
        if (node.id === '__start__') continue;
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

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
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
            workflowSettingsActive={workflowSettingsActive}
            onToggleWorkflowSettings={onToggleWorkflowSettings}
            hasInitialState={hasInitialState}
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
