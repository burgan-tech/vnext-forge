import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import {
  Play, Square, CheckCircle2, XCircle, StopCircle,
  PauseCircle, Circle, Repeat2, LayoutGrid, Activity,
} from 'lucide-react';

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

export const StateNodeBase = memo(function StateNodeBase({ data, selected }: NodeProps) {
  const d = data as StateNodeData;
  const config = getConfig(d.stateType, d.subType);
  const totalActions = d.onEntryCount + d.onExitCount;

  return (
    <div
      className={`group w-[220px] rounded-2xl transition-all duration-200 ${config.borderStyle || 'border-solid'} ${
        selected
          ? `bg-surface border-[1.5px] border-primary-border-hover shadow-xl ring-4 ${config.ring}`
          : 'bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-muted-border-hover'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3! h-3! rounded-full! bg-surface! border-2! border-muted-border! hover:border-primary-border! hover:bg-muted! -left-1.75! transition-all! duration-150!"
      />

      {/* Color accent strip */}
      <div className={`h-[3px] ${config.accent} rounded-t-2xl`} />

      {/* Header */}
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <div className={`size-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
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

      <Handle
        type="source"
        position={Position.Right}
        className="w-3! h-3! rounded-full! bg-surface! border-2! border-muted-border! hover:border-primary-border! hover:bg-muted! -right-1.75! transition-all! duration-150!"
      />
    </div>
  );
});
