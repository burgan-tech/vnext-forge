import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { memo, useCallback, useRef } from 'react';
import { useCanvasViewSettings, type EdgePathStyle } from '../../context/CanvasViewSettingsContext';

export interface Waypoint {
  x: number;
  y: number;
}

interface TransitionEdgeData {
  label?: string;
  transitionKey?: string;
  triggerType?: number;
  triggerKind?: number;
  isShared?: boolean;
  waypoints?: Waypoint[];
  [key: string]: unknown;
}

function getEdgeColor(triggerType: number, triggerKind: number, isShared: boolean): string {
  if (isShared) return 'var(--color-final-terminated)';
  switch (triggerType) {
    case 0: return 'var(--color-final-terminated)';
    case 1:
      if (triggerKind === 10) return 'var(--color-muted-border)';
      return 'var(--color-trigger-auto)';
    case 2: return 'var(--color-trigger-scheduled)';
    case 3: return 'var(--color-trigger-event)';
    default: return 'var(--color-final-terminated)';
  }
}

function getEdgeDash(triggerType: number, triggerKind: number, isShared: boolean): string | undefined {
  if (isShared) return '6 4';
  if (triggerType === 1 && triggerKind === 10) return '4 4';
  if (triggerType === 2) return '3 4';
  return undefined;
}

function getTriggerBadge(triggerType: number, triggerKind: number): { label: string; color: string } {
  if (triggerKind === 10) return { label: 'default', color: 'text-muted-foreground' };
  switch (triggerType) {
    case 0: return { label: '', color: '' };
    case 1: return { label: 'auto', color: 'text-trigger-auto' };
    case 2: return { label: 'cron', color: 'text-trigger-scheduled' };
    case 3: return { label: 'event', color: 'text-trigger-event' };
    default: return { label: '', color: '' };
  }
}

function computeEdgePath(
  style: EdgePathStyle,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: EdgeProps['sourcePosition'];
    targetX: number;
    targetY: number;
    targetPosition: EdgeProps['targetPosition'];
  },
): [string, number, number] {
  switch (style) {
    case 'smoothstep': {
      const [path, labelX, labelY] = getSmoothStepPath({
        ...params,
        borderRadius: 8,
      });
      return [path, labelX, labelY];
    }
    case 'straight': {
      const [path, labelX, labelY] = getStraightPath({
        sourceX: params.sourceX,
        sourceY: params.sourceY,
        targetX: params.targetX,
        targetY: params.targetY,
      });
      return [path, labelX, labelY];
    }
    case 'bezier':
    default: {
      const [path, labelX, labelY] = getBezierPath(params);
      return [path, labelX, labelY];
    }
  }
}

/**
 * Build an SVG path through waypoints using quadratic bezier segments
 * for smooth curves through each point.
 */
function buildWaypointPath(
  sx: number, sy: number,
  tx: number, ty: number,
  waypoints: Waypoint[],
): { path: string; labelX: number; labelY: number } {
  if (waypoints.length === 0) {
    return { path: `M ${sx} ${sy} L ${tx} ${ty}`, labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 };
  }

  const points: Array<{ x: number; y: number }> = [
    { x: sx, y: sy },
    ...waypoints,
    { x: tx, y: ty },
  ];

  let path = `M ${points[0].x} ${points[0].y}`;

  if (points.length === 2) {
    path += ` L ${points[1].x} ${points[1].y}`;
  } else if (points.length === 3) {
    path += ` Q ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`;
  } else {
    // For 4+ points, use smooth cubic segments through control points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const midX1 = (prev.x + curr.x) / 2;
      const midY1 = (prev.y + curr.y) / 2;
      const midX2 = (curr.x + next.x) / 2;
      const midY2 = (curr.y + next.y) / 2;

      if (i === 1) {
        path += ` L ${midX1} ${midY1}`;
      }
      path += ` Q ${curr.x} ${curr.y} ${midX2} ${midY2}`;
    }
    path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  }

  const midIdx = Math.floor(points.length / 2);
  const labelX = points[midIdx].x;
  const labelY = points[midIdx].y;

  return { path, labelX, labelY };
}

export const TransitionEdge = memo(function TransitionEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data,
  } = props;

  const d = (data || {}) as TransitionEdgeData;
  const triggerType = d.triggerType ?? 0;
  const triggerKind = d.triggerKind ?? 0;
  const isShared = d.isShared ?? false;
  const waypoints: Waypoint[] = d.waypoints ?? [];

  const { settings } = useCanvasViewSettings();
  const { setEdges } = useReactFlow();
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origWp: Waypoint } | null>(null);

  const hasWaypoints = waypoints.length > 0;

  // Compute edge path: use waypoints if present, otherwise use standard path
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasWaypoints) {
    const result = buildWaypointPath(sourceX, sourceY, targetX, targetY, waypoints);
    edgePath = result.path;
    labelX = result.labelX;
    labelY = result.labelY;
  } else {
    [edgePath, labelX, labelY] = computeEdgePath(settings.edgePathStyle, {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }

  const color = getEdgeColor(triggerType, triggerKind, isShared);
  const dash = getEdgeDash(triggerType, triggerKind, isShared);
  const badge = getTriggerBadge(triggerType, triggerKind);

  // Double-click on edge path to add a waypoint at that position
  const handleEdgeDoubleClick = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      e.stopPropagation();
      const svg = (e.target as SVGElement).closest('svg');
      if (!svg) return;

      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPoint = point.matrixTransform(ctm.inverse());

      const newWaypoint: Waypoint = {
        x: Math.round(svgPoint.x),
        y: Math.round(svgPoint.y),
      };

      // Insert waypoint in the correct order (closest segment)
      const newWaypoints = [...waypoints];
      if (newWaypoints.length === 0) {
        newWaypoints.push(newWaypoint);
      } else {
        const allPoints = [
          { x: sourceX, y: sourceY },
          ...newWaypoints,
          { x: targetX, y: targetY },
        ];
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < allPoints.length - 1; i++) {
          const midX = (allPoints[i].x + allPoints[i + 1].x) / 2;
          const midY = (allPoints[i].y + allPoints[i + 1].y) / 2;
          const dist = Math.hypot(svgPoint.x - midX, svgPoint.y - midY);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
        newWaypoints.splice(bestIdx, 0, newWaypoint);
      }

      setEdges((edges) =>
        edges.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, waypoints: newWaypoints } }
            : edge,
        ),
      );
    },
    [id, waypoints, sourceX, sourceY, targetX, targetY, setEdges],
  );

  // Drag a waypoint to reposition it
  const handleWaypointPointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      dragRef.current = {
        idx,
        startX: e.clientX,
        startY: e.clientY,
        origWp: { ...waypoints[idx] },
      };
    },
    [waypoints],
  );

  const handleWaypointPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.stopPropagation();

      const svg = document.querySelector('.react-flow__edges')?.closest('svg');
      if (!svg) return;

      const startPt = (svg as SVGSVGElement).createSVGPoint();
      startPt.x = dragRef.current.startX;
      startPt.y = dragRef.current.startY;
      const ctm = (svg as SVGSVGElement).getScreenCTM();
      if (!ctm) return;
      const startSvg = startPt.matrixTransform(ctm.inverse());

      const curPt = (svg as SVGSVGElement).createSVGPoint();
      curPt.x = e.clientX;
      curPt.y = e.clientY;
      const curSvg = curPt.matrixTransform(ctm.inverse());

      const dx = curSvg.x - startSvg.x;
      const dy = curSvg.y - startSvg.y;

      const newWaypoints = [...waypoints];
      newWaypoints[dragRef.current.idx] = {
        x: Math.round(dragRef.current.origWp.x + dx),
        y: Math.round(dragRef.current.origWp.y + dy),
      };

      setEdges((edges) =>
        edges.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, waypoints: newWaypoints } }
            : edge,
        ),
      );
    },
    [id, waypoints, setEdges],
  );

  const handleWaypointPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    },
    [],
  );

  // Double-click on a waypoint to remove it
  const handleWaypointDoubleClick = useCallback(
    (e: React.MouseEvent, idx: number) => {
      e.stopPropagation();
      const newWaypoints = waypoints.filter((_, i) => i !== idx);
      setEdges((edges) =>
        edges.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, waypoints: newWaypoints.length > 0 ? newWaypoints : undefined } }
            : edge,
        ),
      );
    },
    [id, waypoints, setEdges],
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: dash,
          transition: 'stroke-width 0.15s ease',
        }}
        markerEnd={`url(#marker-${id})`}
      />
      {/* Wider invisible path for easier double-click to add waypoints */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onDoubleClick={handleEdgeDoubleClick}
        style={{ cursor: 'crosshair' }}
      />
      <defs>
        <marker
          id={`marker-${id}`}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
        </marker>
      </defs>

      {/* Waypoint control points — rendered only when edge is selected or has waypoints */}
      {hasWaypoints && (
        <EdgeLabelRenderer>
          {waypoints.map((wp, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <div
                onPointerDown={(e) => handleWaypointPointerDown(e, idx)}
                onPointerMove={handleWaypointPointerMove}
                onPointerUp={handleWaypointPointerUp}
                onDoubleClick={(e) => handleWaypointDoubleClick(e, idx)}
                className={`size-3 rounded-full cursor-grab active:cursor-grabbing transition-all duration-150 ${
                  selected
                    ? 'bg-primary-border-hover border border-primary-border-hover shadow-sm scale-125'
                    : 'bg-muted-border border border-muted-border-hover shadow-sm hover:bg-primary-border-hover hover:scale-125'
                }`}
                title="Drag to move, double-click to remove"
              />
            </div>
          ))}
        </EdgeLabelRenderer>
      )}

      {d.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`group/label max-w-[200px] px-2.5 py-1 rounded-lg text-[10px] font-medium bg-surface/95 backdrop-blur-sm border transition-all duration-150 ${
              selected
                ? 'border-primary-border-hover shadow-md text-foreground'
                : 'border-border shadow-sm text-muted-foreground hover:border-muted-border-hover hover:shadow'
            }`}
            title={d.label}
          >
            <span className="leading-none truncate block">{d.label}</span>
            {badge.label && (
              <span className={`ml-1 text-[8px] font-semibold uppercase ${badge.color} shrink-0`}>
                {badge.label}
              </span>
            )}
            {/* Full label tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/label:block z-50">
              <div className="px-2.5 py-1.5 rounded-md border border-primary-border bg-primary text-primary-foreground text-[10px] font-medium shadow-md whitespace-nowrap max-w-[400px]">
                <span className="block truncate">{d.label}</span>
                {d.transitionKey && d.transitionKey !== d.label && (
                  <span className="block text-[9px] opacity-75 font-mono mt-0.5">{d.transitionKey}</span>
                )}
              </div>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
