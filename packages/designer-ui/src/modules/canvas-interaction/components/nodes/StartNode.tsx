import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { Play } from 'lucide-react';

const HIDDEN_HANDLE_CLS = 'edge-handle-strip !flex !items-center !justify-center !opacity-0 !pointer-events-none';
const HANDLE_STYLE: React.CSSProperties = { width: 12, height: 12 };

export const StartNode = memo(function StartNode({ selected, data }: NodeProps) {
  const isSpotlight = Boolean((data as Record<string, unknown>)?.spotlight);

  return (
    <div
      className={`group size-14 rounded-2xl bg-initial flex items-center justify-center text-white transition-all duration-200 ${
        selected
          ? 'shadow-lg shadow-initial/30 ring-4 ring-initial/25 scale-105'
          : 'shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:scale-105'
      } ${isSpotlight ? 'animate-spotlight-pulse' : ''}`}
    >
      <Play size={20} fill="currentColor" strokeWidth={0} />
      {/* Hidden source handles for floating edge routing */}
      <Handle type="source" id="top"    position={Position.Top}    style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="source" id="left"   position={Position.Left}   style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="source" id="right"  position={Position.Right}  style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      {/* Hidden target handles for floating edge routing */}
      <Handle type="target" id="top-target"    position={Position.Top}    style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="target" id="bottom-target" position={Position.Bottom} style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="target" id="left-target"   position={Position.Left}   style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
      <Handle type="target" id="right-target"  position={Position.Right}  style={HANDLE_STYLE} className={HIDDEN_HANDLE_CLS} />
    </div>
  );
});
