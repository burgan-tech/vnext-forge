import { useState, type ReactNode } from 'react';

import type { CorrelationTreeNode, CorrelationTreeResponse } from '../types/quickrun.types';
import { CopyIdButton } from './CopyIdButton';

const UNRESOLVED_REASON: Record<string, string> = {
  'depth-exceeded': 'Not expanded: the runtime depth limit was reached',
  'hop-failed': 'Not expanded: the runtime could not reach this instance',
  'instance-missing': 'Not expanded: the instance no longer exists',
};

export interface CorrelationTreeViewProps {
  tree: CorrelationTreeResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Open a node's flow in its Quick Runner or the designer; omitted when the host cannot navigate. */
  onOpenNode?: (node: CorrelationTreeNode, intent: 'quickrun' | 'designer') => void;
}

/**
 * The whole SubFlow / SubProcess tree under the polled instance (runtime
 * 0.0.99 `instance-correlation`; `hierarchy` on older runtimes). Fetched on
 * demand — the tree can be large and is not part of the state poll.
 */
export function CorrelationTreeView({ tree, loading, error, onRefresh, onOpenNode }: CorrelationTreeViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {tree?.source === 'hierarchy' && (
          <span title="This runtime predates 0.0.99; the tree comes from the older hierarchy function.">
            Basic tree (runtime &lt; 0.0.99)
          </span>
        )}
      </div>
      {error ? (
        <p className="text-[11px] text-[var(--vscode-errorForeground)]">{error}</p>
      ) : !tree ? (
        loading ? null : <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">No tree loaded</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto text-[11px]" role="tree" aria-label="Correlation tree">
          <TreeNode node={tree.root} depth={0} isRoot onOpenNode={onOpenNode} />
        </ul>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  isRoot = false,
  onOpenNode,
}: {
  node: CorrelationTreeNode;
  depth: number;
  isRoot?: boolean;
  onOpenNode?: CorrelationTreeViewProps['onOpenNode'];
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const state = node.ownState ?? node.currentState;
  const deeper = node.currentState && node.ownState && node.currentState !== node.ownState ? node.currentState : null;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-level={depth + 1}>
      <div
        className="flex flex-col gap-0.5 rounded border border-[var(--vscode-panel-border)] p-1.5"
        style={{ marginLeft: depth * 12 }}
      >
        <div className="flex items-center gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-3 shrink-0 text-[var(--vscode-descriptionForeground)]"
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="truncate font-medium" title={`${node.domain}/${node.flow}`}>
            {node.flow}
          </span>
          {node.subFlowType && <Chip>{node.subFlowType === 'P' ? 'SubProcess' : 'SubFlow'}</Chip>}
          {isRoot && <Chip>this instance</Chip>}
          {node.status && <Chip>{node.status}</Chip>}
          {node.terminalOutcome && <Chip>{node.terminalOutcome}</Chip>}
        </div>
        <div className="ml-4 flex flex-col gap-0.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
          {node.key && <span>Key: {node.key}</span>}
          {state && (
            <span>
              State: {state}
              {deeper ? ` → ${deeper}` : ''}
            </span>
          )}
          {node.parentState && <span>Started from: {node.parentState}</span>}
          <span className="flex items-start gap-1">
            <code className="break-all font-mono">{node.id}</code>
            {node.id ? <CopyIdButton value={node.id} label="instance ID" /> : null}
          </span>
          {!node.resolved && (
            <span className="text-[var(--vscode-editorWarning-foreground)]">
              {UNRESOLVED_REASON[node.unresolvedReason ?? ''] ?? 'Not expanded'}
            </span>
          )}
        </div>
        {onOpenNode && !isRoot && (
          <div className="ml-4 mt-0.5 flex items-center gap-1">
            <ActionButton onClick={() => onOpenNode(node, 'quickrun')}>Open Runner</ActionButton>
            <ActionButton onClick={() => onOpenNode(node, 'designer')}>Open in Designer</ActionButton>
          </div>
        )}
      </div>
      {hasChildren && open && (
        <ul role="group" className="mt-1 flex flex-col gap-1">
          {node.children.map((child) => (
            <TreeNode key={child.id || child.correlationId || child.flow} node={child} depth={depth + 1} onOpenNode={onOpenNode} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-[var(--vscode-panel-border)] px-1 text-[9px]">{children}</span>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
    >
      {children}
    </button>
  );
}
