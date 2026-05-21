import { AlertTriangle } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';

interface RawPassthroughBadgeProps {
  unknownKeys: readonly string[];
}

/**
 * Shown in a node's General tab header when the node contains JSON Schema
 * keywords the editor does not surface with first-class UI. The keys are
 * still preserved on save through `RawJsonFallback` — this badge just
 * surfaces their presence.
 */
export function RawPassthroughBadge({ unknownKeys }: RawPassthroughBadgeProps) {
  if (unknownKeys.length === 0) {
    return null;
  }

  const title = `Passthrough keywords: ${unknownKeys.join(', ')}`;

  return (
    <Badge variant="warning" className="gap-1 px-1.5 py-0.5 text-[10px]" title={title}>
      <AlertTriangle aria-hidden className="size-3" />
      {unknownKeys.length} passthrough
    </Badge>
  );
}
