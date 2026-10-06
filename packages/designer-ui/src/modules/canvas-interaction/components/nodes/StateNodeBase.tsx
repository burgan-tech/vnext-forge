import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { memo, useCallback } from 'react';
import {
  Repeat2, Activity, ArrowUpRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Eye, AlertTriangle, Copy, Trash2, ShieldCheck,
} from 'lucide-react';
import { useSubFlowNavigation } from '../../context/SubFlowNavigationContext';
import {
  useCanvasViewSettings,
  resolveIconStampSize,
} from '../../context/CanvasViewSettingsContext';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { useCanvasMode } from '../../context/CanvasModeContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/Tooltip';
import { getStateNodeConfig } from './stateNodeConfig';
import { HumanTaskGateDot, LongPollIndicator } from './StateNodeIndicators';

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
  hasQueryRoles?: boolean;
  visitCount?: number;
  pathOnly?: boolean;
  subFlowProcessKey: string;
  subFlowProcessDomain: string;
  hasLongPoll?: boolean;
  longPollAuth?: 'roles' | 'rule';
  terminate?: boolean;
  fallbackTimeoutSeconds?: number;
  humanTaskGateMissing?: boolean;
  [key: string]: unknown;
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
  const config = getStateNodeConfig(d.stateType, d.subType);
  const totalActions = d.onEntryCount + d.onExitCount;
  const { onOpenSubFlow } = useSubFlowNavigation();
  const { settings } = useCanvasViewSettings();

  // Hover Quick-Toolbar actions — bound to the workflow store so
  // the node component doesn't need callback props threaded
  // through React Flow's `nodeTypes` registry. The toolbar reveals
  // on `group-hover` (the outer div has `group`) and exposes the
  // two most-common actions (Duplicate, Delete). Other actions
  // remain on the right-click menu to avoid toolbar clutter.
  const removeState = useWorkflowStore((s) => s.removeState);
  const duplicateState = useWorkflowStore((s) => s.duplicateState);
  const diagramJson = useWorkflowStore((s) => s.diagramJson);
  const { isEditable } = useCanvasMode();
  const executionStatus = (d as Record<string, unknown>).executionStatus as
    | 'current' | 'visited' | 'unreachable' | undefined;
  const pathOnly = d.pathOnly === true;
  const executionCls =
    executionStatus === 'current' ? 'vf-node-current' :
    executionStatus === 'visited' ? 'vf-node-visited' :
    executionStatus === 'unreachable' ? (pathOnly ? 'vf-node-off-path' : 'vf-node-unreachable') :
    '';
  const visitCount = typeof d.visitCount === 'number' ? d.visitCount : 0;

  const handleQuickDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const positions = (diagramJson?.nodePos as
        | Record<string, { x?: number; y?: number }>
        | undefined) ?? undefined;
      const pos = positions?.[d.stateKey] ?? { x: 200, y: 200 };
      duplicateState(d.stateKey, { x: (pos.x ?? 200) + 40, y: (pos.y ?? 200) + 40 });
    },
    [diagramJson, d.stateKey, duplicateState],
  );

  const handleQuickDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeState(d.stateKey);
    },
    [removeState, d.stateKey],
  );

  // Visual tuning from Canvas Options:
  //   - `nodeDensity = compact` collapses the stats row regardless
  //     of `statsVisibility` to give a denser overview layout.
  //   - `iconSize` maps to size-8 / size-10 / size-12 on the stamp.
  //   - `statsVisibility` controls when the stats row shows:
  //       always → standard
  //       hover  → only when the node is hovered or selected (CSS)
  //       never  → never
  const iconStampNum = resolveIconStampSize(settings.iconSize);
  const isCompact = settings.nodeDensity === 'compact';
  const statsAllowed = !isCompact && settings.statsVisibility !== 'never';
  const statsHoverOnly = settings.statsVisibility === 'hover';

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
      } ${isSpotlight ? 'animate-spotlight-pulse' : ''} ${executionCls}`}
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

      {/*
       * Header — icon stamp + label + stateKey.
       *
       * Previously a 3px accent strip ran across the top edge and
       * the icon sat inside a `bg-{color}/10` soft-tint badge. The
       * strip was nearly invisible at default zoom (especially in
       * dark theme), and the doubled-up color signal (tinted icon
       * badge + strip + type-label text) added visual noise without
       * extra info.
       *
       * New design: solid-colored icon badge (the "state stamp")
       * carries the state-type signal at glance — it's the most
       * visually heavy element of the node and the user's eye lands
       * there first. The textual type-label ("State / Initial /
       * Final / SubFlow") is removed because the stamp and the node
       * shape (dashed for SubFlow, etc.) already convey the type.
       */}
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <div
          // Icon stamp size is dynamic (sm/md/lg = 32/40/48 px) per
          // Canvas Options. Tailwind's `size-N` is statically
          // extracted at build time so we can't interpolate the
          // class name — inline `width`/`height` gives us the same
          // effect without the bundling concern.
          style={{ width: `${iconStampNum * 0.25}rem`, height: `${iconStampNum * 0.25}rem` }}
          className={`relative shrink-0 rounded-xl ${config.accent} flex items-center justify-center shadow-sm ring-1 ring-black/5`}
        >
          <span className="text-white [&>svg]:size-[18px]">{config.icon}</span>
          <HumanTaskGateDot show={Boolean(d.humanTaskGateMissing)} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold text-foreground truncate leading-tight tracking-tight">
            {d.label}
          </h4>
          <div className="mt-0.5">
            <span className="text-[11px] text-muted-foreground font-mono truncate">{d.stateKey}</span>
          </div>
        </div>
        {visitCount > 1 && (
          <span
            className="bg-action/10 text-action shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            title={`Entered ${visitCount} times`}
            aria-label={`Entered ${visitCount} times`}
          >
            ×{visitCount}
          </span>
        )}
      </div>

      {/*
       * Stats row — task / transition counts and feature flags.
       *
       * Feature flags previously rendered as 1.5px colored dots
       * (effectively invisible to anyone with even mild
       * color-deficiency and to a fully-sighted user from more than
       * arm's length). They now render as miniature lucide icons in
       * the same accent color, with explicit `title` and `aria-label`
       * so screen readers can announce them. The icon set:
       *   - Eye          → "Has view" (view component attached)
       *   - AlertTriangle → "Error boundary" defined
       *   - Repeat2      → "SubFlow" embedded
       *   - RadioTower   → "Long poll" (tooltip: terminate · window · arm)
       */}
      {statsAllowed && (totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow || d.hasLongPoll || (!isEditable && d.hasQueryRoles)) && (
        <div
          className={`px-3.5 pb-3 pt-0.5 vf-stats-row ${
            statsHoverOnly ? 'vf-stats-hover-only' : ''
          }`}
        >
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
            {d.hasView && (
              <span
                className="text-final-suspended inline-flex items-center"
                title="Has view"
                aria-label="Has view"
              >
                <Eye size={11} strokeWidth={2.25} />
              </span>
            )}
            {d.hasErrorBoundary && (
              <span
                className="text-final-error inline-flex items-center"
                title="Error boundary"
                aria-label="Error boundary defined"
              >
                <AlertTriangle size={11} strokeWidth={2.25} />
              </span>
            )}
            {d.hasSubFlow && (
              <span
                className="text-subflow inline-flex items-center"
                title="SubFlow"
                aria-label="SubFlow embedded"
              >
                <Repeat2 size={11} strokeWidth={2.25} />
              </span>
            )}
            {!isEditable && d.hasQueryRoles && (
              <span className="text-initial inline-flex items-center" title="Has query roles" aria-label="Has query roles">
                <ShieldCheck size={11} strokeWidth={2.25} />
              </span>
            )}
            <LongPollIndicator
              hasLongPoll={d.hasLongPoll}
              longPollAuth={d.longPollAuth}
              terminate={d.terminate}
              fallbackTimeoutSeconds={d.fallbackTimeoutSeconds}
            />
          </div>
        </div>
      )}

      {/*
       * Hover Quick-Toolbar — appears top-right above the node
       * on `:hover` (via `group-hover`). Two actions: Duplicate
       * and Delete. Hidden until hover so it doesn't clutter the
       * canvas. The `nodrag nopan` classes are essential — React
       * Flow uses them to skip pan/drag handling, otherwise
       * clicking the button would start a node drag.
       * Gated by `isEditable` so the toolbar is invisible in monitoring (read-only) mode.
       */}
      {isEditable && (
        <div
          className="nodrag nopan pointer-events-none absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 opacity-0 shadow-md transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
        >
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleQuickDuplicate}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  aria-label={`Duplicate state ${d.label}`}
                >
                  <Copy size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" variant="default" className="text-[10px]">
                Duplicate
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleQuickDelete}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive-foreground cursor-pointer"
                  aria-label={`Delete state ${d.label}`}
                >
                  <Trash2 size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" variant="default" className="text-[10px]">
                Delete
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
