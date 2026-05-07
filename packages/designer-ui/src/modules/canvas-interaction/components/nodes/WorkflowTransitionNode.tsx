import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import {
  RefreshCw,
  Ban,
  Clock,
  LogOut,
  Share2,
} from 'lucide-react';
type WorkflowTransitionKind = 'updateData' | 'cancel' | 'timeout' | 'exit' | 'shared';

interface WorkflowTransitionNodeData {
  kind: WorkflowTransitionKind;
  label: string;
  [key: string]: unknown;
}

const kindConfig: Record<WorkflowTransitionKind, {
  icon: typeof RefreshCw;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}> = {
  updateData: {
    icon: RefreshCw,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  cancel: {
    icon: Ban,
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-600',
    text: 'text-red-700 dark:text-red-300',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  timeout: {
    icon: Clock,
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-300 dark:border-orange-600',
    text: 'text-orange-700 dark:text-orange-300',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  exit: {
    icon: LogOut,
    bg: 'bg-slate-50 dark:bg-slate-800/60',
    border: 'border-slate-300 dark:border-slate-600',
    text: 'text-slate-700 dark:text-slate-300',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
  shared: {
    icon: Share2,
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-300 dark:border-violet-600',
    text: 'text-violet-700 dark:text-violet-300',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
};

export const WorkflowTransitionNode = memo(function WorkflowTransitionNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as WorkflowTransitionNodeData;
  const kind = nodeData.kind || 'updateData';
  const label = nodeData.label || kind;
  const config = kindConfig[kind] || kindConfig.updateData;
  const Icon = config.icon;

  const stripCls = 'edge-handle-strip';

  const r = 8;
  const hs: Record<string, CSSProperties> = {
    top:    { transform: 'none', top: 0, left: 0, right: 0, width: '100%', height: 8, borderRadius: `${r}px ${r}px 3px 3px` },
    bottom: { transform: 'none', bottom: 0, top: 'auto', left: 0, right: 0, width: '100%', height: 8, borderRadius: `3px 3px ${r}px ${r}px` },
    left:   { transform: 'none', top: 0, bottom: 0, left: 0, height: '100%', width: 8, borderRadius: `${r}px 3px 3px ${r}px` },
    right:  { transform: 'none', top: 0, bottom: 0, right: 0, left: 'auto', height: '100%', width: 8, borderRadius: `3px ${r}px ${r}px 3px` },
  };

  return (
    <div
      className={`group flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 shadow-sm transition-all duration-150 ${config.bg} ${config.border} ${
        selected ? 'ring-2 ring-offset-1 ring-current/20 scale-105' : 'hover:scale-[1.02] hover:shadow-md'
      }`}
      title={label}
    >
      {/* Source handles (visible) */}
      <Handle type="source" id="top"    position={Position.Top}    style={hs.top}    className={stripCls} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={hs.bottom} className={stripCls} />
      <Handle type="source" id="left"   position={Position.Left}   style={hs.left}   className={stripCls} />
      <Handle type="source" id="right"  position={Position.Right}  style={hs.right}  className={stripCls} />
      {/* Hidden target handles for floating edge routing */}
      <Handle type="target" id="top-target"    position={Position.Top}    style={hs.top}    className={`${stripCls} !opacity-0 !pointer-events-none`} />
      <Handle type="target" id="bottom-target" position={Position.Bottom} style={hs.bottom} className={`${stripCls} !opacity-0 !pointer-events-none`} />
      <Handle type="target" id="left-target"   position={Position.Left}   style={hs.left}   className={`${stripCls} !opacity-0 !pointer-events-none`} />
      <Handle type="target" id="right-target"  position={Position.Right}  style={hs.right}  className={`${stripCls} !opacity-0 !pointer-events-none`} />

      <div className={`flex size-5 shrink-0 items-center justify-center rounded ${config.iconColor}`}>
        <Icon size={13} strokeWidth={2} />
      </div>
      <span className={`text-[10px] font-semibold leading-tight ${config.text}`}>
        {label}
      </span>
    </div>
  );
});
