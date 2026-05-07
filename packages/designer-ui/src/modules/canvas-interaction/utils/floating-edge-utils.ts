import { Position, type InternalNode } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 100;

interface Point {
  x: number;
  y: number;
}

function getNodeDimensions(node: InternalNode): { w: number; h: number } {
  return {
    w: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    h: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

function getNodeCenter(node: InternalNode): Point {
  const { w, h } = getNodeDimensions(node);
  return {
    x: node.internals.positionAbsolute.x + w / 2,
    y: node.internals.positionAbsolute.y + h / 2,
  };
}

/**
 * Compute the intersection point on a node's rectangular border
 * along the line from the node's center toward `target`.
 */
function getNodeIntersection(node: InternalNode, target: Point): Point {
  const { w, h } = getNodeDimensions(node);
  const center = getNodeCenter(node);

  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const halfW = w / 2;
  const halfH = h / 2;

  const sx = Math.abs(dx) < 1e-6 ? Infinity : halfW / Math.abs(dx);
  const sy = Math.abs(dy) < 1e-6 ? Infinity : halfH / Math.abs(dy);
  const s = Math.min(sx, sy);

  return {
    x: center.x + dx * s,
    y: center.y + dy * s,
  };
}

function getEdgePosition(node: InternalNode, intersectionPoint: Point): Position {
  const center = getNodeCenter(node);
  const dx = intersectionPoint.x - center.x;
  const dy = intersectionPoint.y - center.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

export interface FloatingEdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
}

/**
 * Compute floating-edge source/target coordinates and positions
 * by intersecting the center-to-center line with each node's border.
 */
export function getFloatingEdgeParams(
  sourceNode: InternalNode,
  targetNode: InternalNode,
): FloatingEdgeParams {
  const targetCenter = getNodeCenter(targetNode);
  const sourceCenter = getNodeCenter(sourceNode);

  const sourceIntersection = getNodeIntersection(sourceNode, targetCenter);
  const targetIntersection = getNodeIntersection(targetNode, sourceCenter);

  const sourcePos = getEdgePosition(sourceNode, sourceIntersection);
  const targetPos = getEdgePosition(targetNode, targetIntersection);

  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos,
    targetPos,
  };
}

/**
 * Compute the border intersection point on a source node toward
 * a free-floating cursor point (used by FloatingConnectionLine).
 */
export function getConnectionLineSource(
  sourceNode: InternalNode,
  cursorX: number,
  cursorY: number,
): Point {
  return getNodeIntersection(sourceNode, { x: cursorX, y: cursorY });
}

function positionToHandleId(pos: Position): string {
  switch (pos) {
    case Position.Top: return 'top';
    case Position.Bottom: return 'bottom';
    case Position.Left: return 'left';
    case Position.Right: return 'right';
  }
}

/**
 * Determine which handle IDs an edge should use based on the
 * relative positions of its source and target nodes.
 */
export function getFloatingHandleIds(
  sourceNode: InternalNode,
  targetNode: InternalNode,
): { sourceHandle: string; targetHandle: string } {
  const params = getFloatingEdgeParams(sourceNode, targetNode);
  return {
    sourceHandle: positionToHandleId(params.sourcePos),
    targetHandle: `${positionToHandleId(params.targetPos)}-target`,
  };
}
