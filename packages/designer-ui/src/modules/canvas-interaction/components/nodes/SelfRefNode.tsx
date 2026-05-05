import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { RotateCcw } from 'lucide-react';

export const SelfRefNode = memo(function SelfRefNode({ data }: NodeProps) {
  const label = (data as Record<string, unknown>).label as string | undefined;

  return (
    <div
      className="flex size-12 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-violet-400 bg-violet-50 shadow-md transition-all hover:scale-110 hover:border-violet-500 hover:shadow-lg dark:border-violet-400 dark:bg-violet-950/60"
      title={label || '$self — current state'}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !rounded-full !border !border-violet-400 !bg-surface"
      />
      <RotateCcw size={18} className="text-violet-600 dark:text-violet-300" />
    </div>
  );
});
