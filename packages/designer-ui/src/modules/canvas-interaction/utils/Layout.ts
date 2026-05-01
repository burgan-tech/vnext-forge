import dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import type { LayoutAlgorithm, LayoutDirection } from '../context/CanvasViewSettingsContext';

const elk = new ELK();

const DEFAULT_STATE_WIDTH = 220;
const DEFAULT_STATE_HEIGHT = 100;
const START_NODE_WIDTH = 40;
const START_NODE_HEIGHT = 40;

function getNodeDimensions(node: Node): { width: number; height: number } {
  if (node.id === '__start__') {
    return { width: START_NODE_WIDTH, height: START_NODE_HEIGHT };
  }
  const width = node.width ?? node.measured?.width ?? DEFAULT_STATE_WIDTH;
  const height = node.height ?? node.measured?.height ?? DEFAULT_STATE_HEIGHT;
  return { width, height };
}

interface LayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
}

function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const rankdir = direction === 'DOWN' ? 'TB' : 'LR';
  g.setGraph({ rankdir, nodesep: 80, ranksep: 120 });

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const layoutNode = g.node(node.id);
    if (layoutNode) {
      const { width, height } = getNodeDimensions(node);
      return {
        ...node,
        position: {
          x: Math.round(layoutNode.x - width / 2),
          y: Math.round(layoutNode.y - height / 2),
        },
      };
    }
    return node;
  });
}

async function layoutWithElk(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
): Promise<Node[]> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: nodes.map((node) => {
      const { width, height } = getNodeDimensions(node);
      return { id: node.id, width, height };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layouted = await elk.layout(graph);

  return nodes.map((node) => {
    const layoutNode = layouted.children?.find((n) => n.id === node.id);
    if (layoutNode) {
      return {
        ...node,
        position: { x: layoutNode.x || 0, y: layoutNode.y || 0 },
      };
    }
    return node;
  });
}

export async function layoutFlow(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Promise<Node[]> {
  const { algorithm = 'dagre', direction = 'DOWN' } = options;

  if (algorithm === 'elk') {
    return layoutWithElk(nodes, edges, direction);
  }
  return layoutWithDagre(nodes, edges, direction);
}

/** @deprecated Use `layoutFlow` instead. Kept for backward compatibility. */
export async function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'RIGHT' | 'DOWN' = 'DOWN',
): Promise<Node[]> {
  return layoutFlow(nodes, edges, { algorithm: 'dagre', direction });
}
