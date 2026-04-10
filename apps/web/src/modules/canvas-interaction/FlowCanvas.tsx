import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
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
import { useWorkflowStore } from '@app/store/useWorkflowStore';
import { workflowToReactFlow, reactFlowToPositions } from './utils/Conversion';
import { autoLayout } from './utils/Layout';
import { CanvasToolbar } from './components/panels/CanvasToolbar';
import {
  CanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
} from './components/menus/CanvasContextMenu';

interface FlowCanvasProps {
  workflowJson: Record<string, unknown>;
  diagramJson: Record<string, unknown>;
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

function FlowCanvasInner({ workflowJson, diagramJson }: FlowCanvasProps) {
  const {
    setSelectedNode,
    setSelectedEdge,
    updateDiagram,
    addState,
    removeState,
    duplicateState,
    changeStateType,
    addTransition,
    removeTransition,
    changeTransitionTrigger,
  } = useWorkflowStore();
  const { fitView, screenToFlowPosition, getViewport } = useReactFlow();
  const autoLayoutDone = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Convert workflow JSON to ReactFlow nodes/edges
  const {
    nodes: computedNodes,
    edges: computedEdges,
    needsLayout,
  } = useMemo(() => {
    const result = workflowToReactFlow(workflowJson as any, diagramJson as any);
    const nodePos = (diagramJson as any)?.nodePos || {};
    const hasPositions = Object.keys(nodePos).length > 0;
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
      autoLayout(computedNodes, computedEdges).then((layoutedNodes) => {
        setNodes(layoutedNodes);
        const positions = reactFlowToPositions(layoutedNodes);
        updateDiagram((draft: any) => {
          draft.nodePos = positions.nodePos;
        });
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      });
    }
  }, [needsLayout, computedNodes, computedEdges, setNodes, updateDiagram, fitView]);

  // ─── Node changes (position, selection, etc.) ───
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  // ─── Node drag → update diagram positions ───
  const onNodeDragStop = useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) => {
      updateDiagram((draft: any) => {
        if (!draft.nodePos) draft.nodePos = {};
        draft.nodePos[node.id] = {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        };
      });
    },
    [updateDiagram],
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
    (event: React.MouseEvent, edge: { id: string; source: string; data?: any }) => {
      event.preventDefault();
      const transitionKey = edge.data?.transitionKey || edge.id;
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
    (deletedEdges: Array<{ id: string; source: string; data?: any }>) => {
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
    const layoutedNodes = await autoLayout(nodes, edges);
    setNodes(layoutedNodes);
    const positions = reactFlowToPositions(layoutedNodes);
    updateDiagram((draft: any) => {
      draft.nodePos = positions.nodePos;
    });
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, setNodes, updateDiagram, fitView]);

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
      const nodePos = (diagramJson as any)?.nodePos?.[key];
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
          <CanvasToolbar onAddState={handleToolbarAddState} onAutoLayout={handleAutoLayout} />
        </Panel>
      </ReactFlow>

      {/* Context Menus */}
      {contextMenu?.type === 'pane' && (
        <CanvasContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onAddState={handleContextMenuAddState}
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

// Wrapper that must be inside ReactFlowProvider
export function FlowCanvas(props: FlowCanvasProps) {
  return <FlowCanvasInner {...props} />;
}
