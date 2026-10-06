import { CorrelationTreeView } from '../../quick-run/components/CorrelationTree';
import type { CorrelationTreeNode, CorrelationTreeResponse } from '../../quick-run/types/quickrun.types';

export interface CorrelationsPanelProps {
  correlation: CorrelationTreeResponse | null;
  onRefresh: () => void;
  onDrill?: (node: CorrelationTreeNode) => void;
}

/** The instance's SubFlow / SubProcess tree with a "Monitor this instance" action per node. */
export function CorrelationsPanel({ correlation, onRefresh, onDrill }: CorrelationsPanelProps) {
  if (!correlation) {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-xs text-[var(--vscode-descriptionForeground,#9d9d9d)]">
        <span>No correlation tree for this instance.</span>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-[var(--vscode-button-border,var(--vscode-panel-border,#454545))] px-2 py-0.5 text-[var(--vscode-foreground,#cccccc)] hover:bg-[var(--vscode-toolbar-hoverBackground,#2a2d2e)]"
        >
          Retry
        </button>
      </div>
    );
  }
  return (
    <CorrelationTreeView
      tree={correlation}
      loading={false}
      error={null}
      onRefresh={onRefresh}
      {...(onDrill ? { onDrillNode: onDrill } : {})}
    />
  );
}
