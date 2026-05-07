import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import {
  RefreshCw,
  Ban,
  Clock,
  LogOut,
  Share2,
} from 'lucide-react';
import { useCanvasViewSettings } from '../../context/CanvasViewSettingsContext';

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
  const { settings } = useCanvasViewSettings();
  const sourcePosition = settings.direction === 'DOWN' ? Position.Bottom : Position.Right;
  const targetPosition = settings.direction === 'DOWN' ? Position.Top : Position.Left;

  const nodeData = data as unknown as WorkflowTransitionNodeData;
  const kind = nodeData.kind || 'updateData';
  const label = nodeData.label || kind;
  const config = kindConfig[kind] || kindConfig.updateData;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 shadow-sm transition-all duration-150 ${config.bg} ${config.border} ${
        selected ? 'ring-2 ring-offset-1 ring-current/20 scale-105' : 'hover:scale-[1.02] hover:shadow-md'
      }`}
      title={label}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!size-2 !rounded-full !border !border-current/30 !bg-surface"
      />
      <div className={`flex size-5 shrink-0 items-center justify-center rounded ${config.iconColor}`}>
        <Icon size={13} strokeWidth={2} />
      </div>
      <span className={`text-[10px] font-semibold leading-tight ${config.text}`}>
        {label}
      </span>
      <Handle
        type="source"
        position={sourcePosition}
        className="!size-2 !rounded-full !border !border-current/30 !bg-surface"
      />
    </div>
  );
});
