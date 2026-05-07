import { useInternalNode, type ConnectionLineComponentProps } from '@xyflow/react';
import { getConnectionLineSource } from '../../utils/floating-edge-utils';

export function FloatingConnectionLine({
  toX,
  toY,
  fromNode,
}: ConnectionLineComponentProps) {
  const sourceNode = useInternalNode(fromNode?.id ?? '');

  if (!sourceNode) {
    return null;
  }

  const { x: sx, y: sy } = getConnectionLineSource(sourceNode, toX, toY);

  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        fill="none"
        r={3}
        stroke="var(--color-primary-border)"
        strokeWidth={1.5}
      />
      <path
        fill="none"
        stroke="var(--color-primary-border)"
        strokeWidth={1.5}
        className="animated"
        d={`M ${sx},${sy} L ${toX},${toY}`}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="var(--color-primary-border)"
        r={3}
        stroke="var(--color-primary-border)"
        strokeWidth={1.5}
      />
    </g>
  );
}
