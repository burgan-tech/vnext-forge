import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { memo } from 'react';

interface TransitionEdgeData {
  label?: string;
  transitionKey?: string;
  triggerType?: number;
  triggerKind?: number;
  isShared?: boolean;
  [key: string]: unknown;
}

function getEdgeColor(triggerType: number, triggerKind: number, isShared: boolean): string {
  if (isShared) return '#9ca3af';
  switch (triggerType) {
    case 0: return '#94a3b8'; // Manual - slate
    case 1:
      if (triggerKind === 10) return '#cbd5e1'; // Default auto - light
      return '#34d399'; // Auto - emerald
    case 2: return '#fb923c'; // Scheduled - orange
    case 3: return '#a78bfa'; // Event - violet
    default: return '#94a3b8';
  }
}

function getEdgeDash(triggerType: number, triggerKind: number, isShared: boolean): string | undefined {
  if (isShared) return '6 4';
  if (triggerType === 1 && triggerKind === 10) return '4 4';
  if (triggerType === 2) return '3 4';
  return undefined;
}

function getTriggerBadge(triggerType: number, triggerKind: number): { label: string; color: string } {
  if (triggerKind === 10) return { label: 'default', color: 'text-slate-400' };
  switch (triggerType) {
    case 0: return { label: '', color: '' }; // Manual - no badge needed
    case 1: return { label: 'auto', color: 'text-emerald-500' };
    case 2: return { label: 'cron', color: 'text-orange-500' };
    case 3: return { label: 'event', color: 'text-violet-500' };
    default: return { label: '', color: '' };
  }
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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = getEdgeColor(triggerType, triggerKind, isShared);
  const dash = getEdgeDash(triggerType, triggerKind, isShared);
  const badge = getTriggerBadge(triggerType, triggerKind);

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
      {d.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/95 backdrop-blur-sm border transition-all duration-150 ${
              selected
                ? 'border-indigo-300 shadow-md shadow-indigo-500/10 text-slate-900'
                : 'border-slate-200/80 shadow-sm text-slate-600 hover:border-slate-300 hover:shadow'
            }`}
          >
            <span className="leading-none">{d.label}</span>
            {badge.label && (
              <span className={`ml-1 text-[8px] font-semibold uppercase ${badge.color}`}>
                {badge.label}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
