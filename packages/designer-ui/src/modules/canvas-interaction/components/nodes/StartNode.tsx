import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { Play } from 'lucide-react';
import { useCanvasViewSettings } from '../../context/CanvasViewSettingsContext';

export const StartNode = memo(function StartNode({ selected }: NodeProps) {
  const { settings } = useCanvasViewSettings();
  const sourcePosition = settings.direction === 'DOWN' ? Position.Bottom : Position.Right;

  return (
    <div
      className={`size-12 rounded-2xl bg-initial flex items-center justify-center text-white transition-all duration-200 ${
        selected
          ? 'shadow-lg shadow-initial/30 ring-4 ring-initial/25 scale-105'
          : 'shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:scale-105'
      }`}
    >
      <Play size={18} fill="currentColor" strokeWidth={0} />
      <Handle
        type="source"
        position={sourcePosition}
        className="w-4! h-4! rounded-full! bg-surface! border-2! border-initial! hover:border-initial! hover:bg-initial/20! hover:scale-125! transition-all! duration-150!"
      />
    </div>
  );
});
