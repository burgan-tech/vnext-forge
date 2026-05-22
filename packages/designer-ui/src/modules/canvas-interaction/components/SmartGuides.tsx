import { memo } from 'react';
import { useStore as useReactFlowStore } from '@xyflow/react';

/**
 * A single alignment guideline computed while a node is being
 * dragged. `orientation` is the line's *direction*:
 *   - `h` (horizontal) → drawn as a horizontal line across the
 *      canvas, with `pos` being its `y` flow-coordinate.
 *   - `v` (vertical)   → drawn as a vertical line, with `pos`
 *      being its `x` flow-coordinate.
 *
 * `kind` describes which alignment family the guide came from
 * (top/center/bottom for horizontal; left/center/right for
 * vertical). Used purely for tooltip / debug; the line looks
 * the same either way.
 */
export interface SmartGuide {
  orientation: 'h' | 'v';
  pos: number;
  kind: 'top' | 'center-y' | 'bottom' | 'left' | 'center-x' | 'right';
}

interface SmartGuidesOverlayProps {
  guides: SmartGuide[];
}

/**
 * SVG overlay that paints active smart guides on top of the
 * canvas. Lives inside the React Flow wrapper so it can share
 * the viewport transform — guides are positioned in *flow*
 * coordinates and the `<g>` transform brings them into screen
 * space the same way React Flow renders nodes.
 *
 * Strokes use `vector-effect: non-scaling-stroke` so a single
 * pixel line stays crisp regardless of zoom level. Lines extend
 * far past the visible area so a guide will always reach the
 * edges of the viewport at any zoom.
 */
export const SmartGuidesOverlay = memo(function SmartGuidesOverlay({
  guides,
}: SmartGuidesOverlayProps) {
  const transform = useReactFlowStore((s) => s.transform);

  if (guides.length === 0) return null;

  const [tx, ty, zoom] = transform;

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
        {guides.map((g, i) =>
          g.orientation === 'h' ? (
            <line
              key={`h-${i}-${g.pos}`}
              x1={-100000}
              x2={100000}
              y1={g.pos}
              y2={g.pos}
              stroke="var(--color-action)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
          ) : (
            <line
              key={`v-${i}-${g.pos}`}
              x1={g.pos}
              x2={g.pos}
              y1={-100000}
              y2={100000}
              stroke="var(--color-action)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
          ),
        )}
      </g>
    </svg>
  );
});

/**
 * Bounding-box geometry for a single node, in flow coordinates.
 * Pulled from React Flow's `node.position` (top-left corner) +
 * `measured.width/height` (rendered size, populated by React Flow
 * after the node is mounted).
 */
export interface NodeBBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pure computation: given the *dragged* node's bbox and a list of
 * other node bboxes, find which axis-aligned edges align (within a
 * pixel threshold).
 *
 * Returns:
 *   - `guides`: lines to draw on the canvas
 *   - `snapDelta`: how much to nudge the dragged position so the
 *      nearest alignment becomes exact. `{ x: 0, y: 0 }` when no
 *      alignment is close enough.
 *
 * The threshold defaults to 6 flow-pixels — close enough to feel
 * "magnetic" but loose enough that intentional non-alignments
 * don't get hijacked.
 *
 * Performance: O(N) per drag tick where N is the number of other
 * nodes. With React Flow's typical 16ms drag throttle, this
 * supports several hundred nodes comfortably.
 */
export function computeSmartGuides(
  dragged: NodeBBox,
  others: NodeBBox[],
  threshold = 6,
): { guides: SmartGuide[]; snapDelta: { x: number; y: number } } {
  const dragLeft = dragged.x;
  const dragCenterX = dragged.x + dragged.width / 2;
  const dragRight = dragged.x + dragged.width;
  const dragTop = dragged.y;
  const dragCenterY = dragged.y + dragged.height / 2;
  const dragBottom = dragged.y + dragged.height;

  const allGuides: SmartGuide[] = [];
  let bestXDelta = Infinity;
  let bestYDelta = Infinity;
  let snapX = 0;
  let snapY = 0;

  // Horizontal-axis (X) alignments: dragged left/center/right
  // matches another node's left/center/right.
  const xPairs: Array<['left' | 'center-x' | 'right', number]> = [
    ['left', dragLeft],
    ['center-x', dragCenterX],
    ['right', dragRight],
  ];
  // Vertical-axis (Y) alignments: top/center-y/bottom.
  const yPairs: Array<['top' | 'center-y' | 'bottom', number]> = [
    ['top', dragTop],
    ['center-y', dragCenterY],
    ['bottom', dragBottom],
  ];

  for (const other of others) {
    const otherLeft = other.x;
    const otherCenterX = other.x + other.width / 2;
    const otherRight = other.x + other.width;
    const otherTop = other.y;
    const otherCenterY = other.y + other.height / 2;
    const otherBottom = other.y + other.height;

    const otherXPairs: Array<[string, number]> = [
      ['left', otherLeft],
      ['center-x', otherCenterX],
      ['right', otherRight],
    ];
    const otherYPairs: Array<[string, number]> = [
      ['top', otherTop],
      ['center-y', otherCenterY],
      ['bottom', otherBottom],
    ];

    // Vertical guide (line goes top-to-bottom) — happens when an
    // X coordinate matches.
    for (const [dragKind, dragVal] of xPairs) {
      for (const [, otherVal] of otherXPairs) {
        const diff = otherVal - dragVal;
        if (Math.abs(diff) < threshold) {
          allGuides.push({ orientation: 'v', pos: otherVal, kind: dragKind });
          if (Math.abs(diff) < Math.abs(bestXDelta)) {
            bestXDelta = diff;
            snapX = diff;
          }
        }
      }
    }

    // Horizontal guide (line goes left-to-right) — happens when a
    // Y coordinate matches.
    for (const [dragKind, dragVal] of yPairs) {
      for (const [, otherVal] of otherYPairs) {
        const diff = otherVal - dragVal;
        if (Math.abs(diff) < threshold) {
          allGuides.push({ orientation: 'h', pos: otherVal, kind: dragKind });
          if (Math.abs(diff) < Math.abs(bestYDelta)) {
            bestYDelta = diff;
            snapY = diff;
          }
        }
      }
    }
  }

  // De-duplicate exact positions to avoid drawing the same line
  // multiple times when several nodes happen to share an edge.
  const seen = new Set<string>();
  const guides: SmartGuide[] = [];
  for (const g of allGuides) {
    const key = `${g.orientation}:${Math.round(g.pos * 100) / 100}`;
    if (seen.has(key)) continue;
    seen.add(key);
    guides.push(g);
  }

  return {
    guides,
    snapDelta: {
      x: isFinite(bestXDelta) ? snapX : 0,
      y: isFinite(bestYDelta) ? snapY : 0,
    },
  };
}
