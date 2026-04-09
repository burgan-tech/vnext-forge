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
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', accent: 'bg-emerald-500', ring: 'ring-emerald-500/20', icon: <Play size={16} />, typeLabel: 'Initial' };
    case 3:
      switch (subType) {
        case 1: return { bg: 'bg-green-500/10', text: 'text-green-600', accent: 'bg-green-500', ring: 'ring-green-500/20', icon: <CheckCircle2 size={16} />, typeLabel: 'Success' };
        case 2: return { bg: 'bg-rose-500/10', text: 'text-rose-600', accent: 'bg-rose-500', ring: 'ring-rose-500/20', icon: <XCircle size={16} />, typeLabel: 'Error' };
        case 3: return { bg: 'bg-slate-500/10', text: 'text-slate-500', accent: 'bg-slate-400', ring: 'ring-slate-500/20', icon: <StopCircle size={16} />, typeLabel: 'Terminated' };
        case 4: return { bg: 'bg-amber-500/10', text: 'text-amber-600', accent: 'bg-amber-500', ring: 'ring-amber-500/20', icon: <PauseCircle size={16} />, typeLabel: 'Suspended' };
        default: return { bg: 'bg-slate-500/10', text: 'text-slate-500', accent: 'bg-slate-400', ring: 'ring-slate-500/20', icon: <Circle size={16} />, typeLabel: 'Final' };
      }
    case 4:
      return { bg: 'bg-violet-500/10', text: 'text-violet-600', accent: 'bg-violet-500', ring: 'ring-violet-500/20', icon: <Repeat2 size={16} />, typeLabel: 'SubFlow', borderStyle: 'border-dashed' };
    case 5:
      return { bg: 'bg-orange-500/10', text: 'text-orange-600', accent: 'bg-orange-500', ring: 'ring-orange-500/20', icon: <LayoutGrid size={16} />, typeLabel: 'Wizard' };
    default:
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-600', accent: 'bg-indigo-500', ring: 'ring-indigo-500/20', icon: <Square size={16} />, typeLabel: 'State' };
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
          ? `bg-white border-[1.5px] border-indigo-400/60 shadow-xl shadow-indigo-500/[0.08] ring-4 ${config.ring}`
          : 'bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-300/80'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-slate-300 hover:!border-indigo-400 hover:!bg-indigo-50 !-left-[7px] !transition-all !duration-150"
      />

      {/* Color accent strip */}
      <div className={`h-[3px] ${config.accent} rounded-t-2xl`} />

      {/* Header */}
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <div className={`size-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
          <span className={config.text}>{config.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold text-slate-900 truncate leading-tight tracking-tight">
            {d.label}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[11px] font-medium ${config.text}`}>{config.typeLabel}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] text-slate-400 font-mono truncate">{d.stateKey}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {(totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow) && (
        <div className="px-3.5 pb-3 pt-0.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            {totalActions > 0 && (
              <span className="flex items-center gap-1 bg-slate-100/80 rounded-full px-2 py-0.5">
                <Activity size={10} className="text-slate-400" />
                <span className="font-medium text-slate-600">{totalActions}</span>
                <span className="text-slate-400">tasks</span>
              </span>
            )}
            {d.transitionCount > 0 && (
              <span className="flex items-center gap-1 bg-slate-100/80 rounded-full px-2 py-0.5">
                <span className="font-medium text-slate-600">{d.transitionCount}</span>
                <span className="text-slate-400">trans</span>
              </span>
            )}
            {d.hasView && <span className="size-1.5 rounded-full bg-amber-400" title="Has view" />}
            {d.hasErrorBoundary && <span className="size-1.5 rounded-full bg-rose-400" title="Error boundary" />}
            {d.hasSubFlow && <span className="size-1.5 rounded-full bg-violet-400" title="SubFlow" />}
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-slate-300 hover:!border-indigo-400 hover:!bg-indigo-50 !-right-[7px] !transition-all !duration-150"
      />
    </div>
  );
});
