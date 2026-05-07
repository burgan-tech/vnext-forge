import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import { Play } from 'lucide-react';

const STRIP_CLS = 'edge-handle-strip';

const R = 16;
const S: Record<string, CSSProperties> = {
  top:    { transform: 'none', top: 0, left: 0, right: 0, width: '100%', height: 10, borderRadius: `${R}px ${R}px 4px 4px` },
  bottom: { transform: 'none', bottom: 0, top: 'auto', left: 0, right: 0, width: '100%', height: 10, borderRadius: `4px 4px ${R}px ${R}px` },
  left:   { transform: 'none', top: 0, bottom: 0, left: 0, height: '100%', width: 10, borderRadius: `${R}px 4px 4px ${R}px` },
  right:  { transform: 'none', top: 0, bottom: 0, right: 0, left: 'auto', height: '100%', width: 10, borderRadius: `4px ${R}px ${R}px 4px` },
};

export const StartNode = memo(function StartNode({ selected, data }: NodeProps) {
  const isSpotlight = Boolean((data as Record<string, unknown>)?.spotlight);

  return (
    <div
      className={`group size-12 rounded-2xl bg-initial flex items-center justify-center text-white transition-all duration-200 ${
        selected
          ? 'shadow-lg shadow-initial/30 ring-4 ring-initial/25 scale-105'
          : 'shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:scale-105'
      } ${isSpotlight ? 'animate-spotlight-pulse' : ''}`}
    >
      <Play size={18} fill="currentColor" strokeWidth={0} />
      <Handle type="source" id="top"    position={Position.Top}    style={S.top}    className={STRIP_CLS} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={S.bottom} className={STRIP_CLS} />
      <Handle type="source" id="left"   position={Position.Left}   style={S.left}   className={STRIP_CLS} />
      <Handle type="source" id="right"  position={Position.Right}  style={S.right}  className={STRIP_CLS} />
    </div>
  );
});
