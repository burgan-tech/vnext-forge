import { CorrelationTreeView } from '../../quick-run/components/CorrelationTree';
import type { CorrelationTreeNode, CorrelationTreeResponse } from '../../quick-run/types/quickrun.types';

export interface CorrelationsPanelProps {
  correlation: CorrelationTreeResponse | null;
  onRefresh: () => void;
  onDrill?: (node: CorrelationTreeNode) => void;
}

/** The instance's SubFlow / SubProcess tree with a "Monitor this instance" action per node. */
export function CorrelationsPanel({ correlation, onRefresh, onDrill }: CorrelationsPanelProps) {
  return (
    <CorrelationTreeView
      tree={correlation}
      loading={false}
      error={correlation ? null : 'Correlation tree is not available for this instance.'}
      onRefresh={onRefresh}
      {...(onDrill ? { onDrillNode: onDrill } : {})}
    />
  );
}
