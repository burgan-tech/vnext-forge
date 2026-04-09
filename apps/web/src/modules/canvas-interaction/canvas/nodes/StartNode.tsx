import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { Play } from 'lucide-react';

export const StartNode = memo(function StartNode({ selected }: NodeProps) {
  return (
    <div
      className={`size-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white transition-all duration-200 ${
        selected
          ? 'shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/25 scale-105'
          : 'shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:scale-105'
      }`}
    >
      <Play size={18} fill="currentColor" strokeWidth={0} />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-emerald-400 hover:!border-emerald-300 !-right-[7px] !transition-all !duration-150"
      />
    </div>
  );
});
