import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { memo, useCallback } from 'react';
import {
  Play, Square, CheckCircle2, XCircle, StopCircle,
  PauseCircle, Circle, Repeat2, LayoutGrid, Activity,
  Loader2, UserCircle, Ban, TimerOff, ArrowUpRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { useSubFlowNavigation } from '../../context/SubFlowNavigationContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/Tooltip';

interface StateNodeData {
  label: string;
  stateKey: string;
  stateType: number;
  subType: number;
  onEntryCount: number;
  onExitCount: number;
  transitionCount: number;
  hasView: boolean;
  hasErrorBoundary: boolean;
  hasSubFlow: boolean;
  subFlowProcessKey: string;
  subFlowProcessDomain: string;
  [key: string]: unknown;
}

interface StateNodeConfig {
  bg: string;
  text: string;
  accent: string;
  ring: string;
  icon: React.ReactNode;
  typeLabel: string;
  borderStyle?: string;
}

function getConfig(stateType: number, subType: number): StateNodeConfig {
  switch (stateType) {
    case 1:
      return { bg: 'bg-initial/10', text: 'text-initial', accent: 'bg-initial', ring: 'ring-initial/20', icon: <Play size={16} />, typeLabel: 'Initial' };
    case 3:
      switch (subType) {
        case 1: return { bg: 'bg-final-success/10', text: 'text-final-success', accent: 'bg-final-success', ring: 'ring-final-success/20', icon: <CheckCircle2 size={16} />, typeLabel: 'Success' };
        case 2: return { bg: 'bg-final-error/10', text: 'text-final-error', accent: 'bg-final-error', ring: 'ring-final-error/20', icon: <XCircle size={16} />, typeLabel: 'Error' };
        case 3: return { bg: 'bg-final-terminated/10', text: 'text-final-terminated', accent: 'bg-final-terminated', ring: 'ring-final-terminated/20', icon: <StopCircle size={16} />, typeLabel: 'Terminated' };
        case 4: return { bg: 'bg-final-suspended/10', text: 'text-final-suspended', accent: 'bg-final-suspended', ring: 'ring-final-suspended/20', icon: <PauseCircle size={16} />, typeLabel: 'Suspended' };
        case 5: return { bg: 'bg-sky-500/10', text: 'text-sky-600', accent: 'bg-sky-500', ring: 'ring-sky-500/20', icon: <Loader2 size={16} />, typeLabel: 'Busy' };
        case 6: return { bg: 'bg-indigo-500/10', text: 'text-indigo-600', accent: 'bg-indigo-500', ring: 'ring-indigo-500/20', icon: <UserCircle size={16} />, typeLabel: 'Human' };
        case 7: return { bg: 'bg-rose-500/10', text: 'text-rose-600', accent: 'bg-rose-500', ring: 'ring-rose-500/20', icon: <Ban size={16} />, typeLabel: 'Cancelled' };
        case 8: return { bg: 'bg-amber-500/10', text: 'text-amber-600', accent: 'bg-amber-500', ring: 'ring-amber-500/20', icon: <TimerOff size={16} />, typeLabel: 'Timeout' };
        default: return { bg: 'bg-final-terminated/10', text: 'text-final-terminated', accent: 'bg-final-terminated', ring: 'ring-final-terminated/20', icon: <Circle size={16} />, typeLabel: 'Final' };
      }
    case 4:
      return { bg: 'bg-subflow/10', text: 'text-subflow', accent: 'bg-subflow', ring: 'ring-subflow/20', icon: <Repeat2 size={16} />, typeLabel: 'SubFlow', borderStyle: 'border-dashed' };
    case 5:
      return { bg: 'bg-wizard/10', text: 'text-wizard', accent: 'bg-wizard', ring: 'ring-wizard/20', icon: <LayoutGrid size={16} />, typeLabel: 'Wizard' };
    default:
      return { bg: 'bg-intermediate/10', text: 'text-intermediate', accent: 'bg-intermediate', ring: 'ring-intermediate/20', icon: <Square size={16} />, typeLabel: 'State' };
  }
}

const ARROW_ICON = { [Position.Top]: ArrowUp, [Position.Bottom]: ArrowDown, [Position.Left]: ArrowLeft, [Position.Right]: ArrowRight } as const;

const NODE_RADIUS = 16;

// Each handle renders as a small circular dot at the midpoint of the
// corresponding edge. React Flow's default positioning already places
// the dot half-inside / half-outside the node border (Easy Connect
// look), so we just let it run and only override the size + shape.
// `transform: undefined` falls back to React Flow's default
// `translate(-50%, -50%)` centering.
const HANDLE_STYLE: Record<string, React.CSSProperties> = {
  [Position.Top]: { width: 12, height: 12 },
  [Position.Bottom]: { width: 12, height: 12 },
  [Position.Left]: { width: 12, height: 12 },
  [Position.Right]: { width: 12, height: 12 },
};

function EdgeHandle({ position, id }: { position: Position; id: string }) {
  const Icon = ARROW_ICON[position];

  return (
    <>
      <Handle
        type="source"
        position={position}
        id={id}
        style={HANDLE_STYLE[position]}
        className="edge-handle-strip !flex !items-center !justify-center"
      >
        <span className="edge-handle-icon">
          <Icon size={12} strokeWidth={3} />
        </span>
      </Handle>
      <Handle
        type="target"
        position={position}
        id={`${id}-target`}
        style={HANDLE_STYLE[position]}
        className="edge-handle-strip !flex !items-center !justify-center !opacity-0 !pointer-events-none"
      />
    </>
  );
}

function TargetOnlyHandle({ position, id }: { position: Position; id: string }) {
  const Icon = ARROW_ICON[position];

  return (
    <Handle
      type="target"
      position={position}
      id={`${id}-target`}
      style={HANDLE_STYLE[position]}
      className="edge-handle-strip !flex !items-center !justify-center"
    >
      <span className="edge-handle-icon">
        <Icon size={12} strokeWidth={3} />
      </span>
    </Handle>
  );
}

export const StateNodeBase = memo(function StateNodeBase({ data, selected }: NodeProps) {
  const d = data as StateNodeData;
  const config = getConfig(d.stateType, d.subType);
  const totalActions = d.onEntryCount + d.onExitCount;
  const { onOpenSubFlow } = useSubFlowNavigation();

  const isFinal = d.stateType === 3;
  const showSubFlowButton = d.stateType === 4 && Boolean(d.subFlowProcessKey);

  const handleOpenSubFlow = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenSubFlow(d.subFlowProcessKey, d.subFlowProcessDomain);
    },
    [onOpenSubFlow, d.subFlowProcessKey, d.subFlowProcessDomain],
  );

  const isSpotlight = Boolean(d.spotlight);

  return (
    <div
      className={`group relative h-full min-h-0 min-w-0 rounded-2xl transition-all duration-200 ${config.borderStyle || 'border-solid'} ${
        selected
          ? `bg-surface border-[1.5px] border-primary-border-hover shadow-xl ring-4 ${config.ring}`
          : 'bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-muted-border-hover'
      } ${isSpotlight ? 'animate-spotlight-pulse' : ''}`}
    >
      <NodeResizer
        minWidth={160}
        maxWidth={480}
        minHeight={64}
        maxHeight={320}
        isVisible={selected ?? false}
        lineClassName="!border-primary-border-hover/40"
        handleClassName="!w-2.5 !h-2.5 !rounded-sm !border !border-primary-border-hover !bg-surface"
      />

      {/* Dual source+target handles at each position for floating edge compatibility */}
      {isFinal ? (
        <>
          <TargetOnlyHandle position={Position.Top}    id="top" />
          <TargetOnlyHandle position={Position.Left}   id="left" />
          <TargetOnlyHandle position={Position.Bottom} id="bottom" />
          <TargetOnlyHandle position={Position.Right}  id="right" />
        </>
      ) : (
        <>
          <EdgeHandle position={Position.Top}    id="top" />
          <EdgeHandle position={Position.Bottom} id="bottom" />
          <EdgeHandle position={Position.Left}   id="left" />
          <EdgeHandle position={Position.Right}  id="right" />
        </>
      )}

      {/* Color accent strip */}
      <div className={`h-[3px] ${config.accent} rounded-t-2xl`} />

      {/* Header */}
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <div className={`size-9 shrink-0 rounded-xl ${config.bg} flex items-center justify-center`}>
          <span className={config.text}>{config.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold text-foreground truncate leading-tight tracking-tight">
            {d.label}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[11px] font-medium ${config.text}`}>{config.typeLabel}</span>
            <span className="text-subtle">·</span>
            <span className="text-[11px] text-muted-foreground font-mono truncate">{d.stateKey}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {(totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow) && (
        <div className="px-3.5 pb-3 pt-0.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            {totalActions > 0 && (
              <span className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                <Activity size={10} className="text-muted-icon" />
                <span className="font-medium text-muted-foreground">{totalActions}</span>
                <span className="text-muted-foreground">tasks</span>
              </span>
            )}
            {d.transitionCount > 0 && (
              <span className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                <span className="font-medium text-muted-foreground">{d.transitionCount}</span>
                <span className="text-muted-foreground">trans</span>
              </span>
            )}
            {d.hasView && <span className="size-1.5 rounded-full bg-final-suspended" title="Has view" />}
            {d.hasErrorBoundary && <span className="size-1.5 rounded-full bg-final-error" title="Error boundary" />}
            {d.hasSubFlow && <span className="size-1.5 rounded-full bg-subflow" title="SubFlow" />}
          </div>
        </div>
      )}

      {showSubFlowButton && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="nodrag nopan absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-md border border-subflow/30 bg-subflow/15 text-subflow transition-all duration-150 hover:bg-subflow/25 hover:border-subflow/50 hover:scale-110 cursor-pointer"
                onClick={handleOpenSubFlow}
                aria-label="Open SubFlow"
              >
                <ArrowUpRight size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" variant="default">
              Open SubFlow
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});
