import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, MoreHorizontal, RefreshCw, XCircle } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../ui/DropdownMenu';
import type { CorrelationTreeNode, CorrelationTreeResponse } from '../types/quickrun.types';
import { allExpandableIds, defaultExpanded, flattenTree, memberLabel, nodeState, type TreeRow } from '../utils/correlationTreeModel';
import { DetailsDialog, DetailsList } from './panel-kit';

const UNRESOLVED_REASON: Record<string, string> = {
  'depth-exceeded': 'Not expanded: the runtime depth limit was reached',
  'hop-failed': 'Not expanded: the runtime could not reach this instance',
  'instance-missing': 'Not expanded: the instance no longer exists',
};

const STATUS: Record<string, { label: string; color: string }> = {
  A: { label: 'Active', color: 'var(--vscode-charts-green,#89d185)' },
  B: { label: 'Busy', color: 'var(--vscode-charts-orange,#d18616)' },
  C: { label: 'Completed', color: 'var(--vscode-descriptionForeground)' },
  F: { label: 'Faulted', color: 'var(--vscode-errorForeground,#f48771)' },
  P: { label: 'Passive', color: 'var(--vscode-disabledForeground, var(--vscode-descriptionForeground))' },
};

const TYPE_LABEL: Record<string, string> = { S: 'SubFlow', P: 'SubProcess' };

const INDENT = 14;

export interface CorrelationTreeViewProps {
  tree: CorrelationTreeResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Open a node's flow in its Quick Runner or the designer; omitted when the host cannot navigate. */
  onOpenNode?: (node: CorrelationTreeNode, intent: 'quickrun' | 'designer') => void;
}

/**
 * The whole SubFlow / SubProcess tree under the polled instance as compact,
 * keyboard-navigable rows (↑ ↓ move, ← → collapse / expand, Enter opens).
 * Siblings in the same flow, state and status fold into "flow ×N" groups;
 * ids, timestamps and the open actions sit in a details dialog.
 */
export function CorrelationTreeView({ tree, loading, error, onRefresh, onOpenNode }: CorrelationTreeViewProps) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CorrelationTreeNode | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isExpanded = useCallback(
    (id: string, depth: number, kind: TreeRow['kind']) => overrides[id] ?? defaultExpanded(id, depth, kind),
    [overrides],
  );
  const rows = useMemo(() => (tree ? flattenTree(tree.root, isExpanded) : []), [tree, isExpanded]);
  const activeId = focusedId && rows.some((r) => r.id === focusedId) ? focusedId : rows[0]?.id ?? null;

  const setExpanded = (id: string, open: boolean) => setOverrides((o) => ({ ...o, [id]: open }));
  const expandAll = () => {
    if (!tree) return;
    setOverrides(Object.fromEntries(allExpandableIds(tree.root).map((id) => [id, true])));
  };
  const collapseAll = () => {
    if (!tree) return;
    setOverrides(Object.fromEntries(allExpandableIds(tree.root).map((id) => [id, false])));
  };

  const focusRow = (id: string) => {
    setFocusedId(id);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
    });
  };

  const activate = (row: TreeRow) => {
    if (row.kind === 'group') setExpanded(row.id, !isExpanded(row.id, row.depth, 'group'));
    else setSelected(row.node);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const index = rows.findIndex((r) => r.id === activeId);
    if (index < 0) return;
    const row = rows[index];
    const expandable = row.kind === 'group' || row.hasChildren;
    const open = expandable && isExpanded(row.id, row.depth, row.kind);
    switch (e.key) {
      case 'ArrowDown':
        if (index < rows.length - 1) focusRow(rows[index + 1].id);
        break;
      case 'ArrowUp':
        if (index > 0) focusRow(rows[index - 1].id);
        break;
      case 'Home':
        focusRow(rows[0].id);
        break;
      case 'End':
        focusRow(rows[rows.length - 1].id);
        break;
      case 'ArrowRight':
        if (expandable && !open) setExpanded(row.id, true);
        else if (open && rows[index + 1]) focusRow(rows[index + 1].id);
        break;
      case 'ArrowLeft':
        if (open) setExpanded(row.id, false);
        else if (row.parentId) focusRow(row.parentId);
        break;
      case 'Enter':
      case ' ':
        activate(row);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <ToolbarButton onClick={expandAll} disabled={!tree} label="Expand all">
          <ChevronsUpDown size={12} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton onClick={collapseAll} disabled={!tree} label="Collapse all">
          <ChevronsDownUp size={12} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton onClick={onRefresh} disabled={loading} label={loading ? 'Loading…' : 'Refresh'}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
        </ToolbarButton>
        {tree?.source === 'hierarchy' && (
          <span className="ml-auto" title="This runtime predates 0.0.99; the tree comes from the older hierarchy function.">
            Basic tree (runtime &lt; 0.0.99)
          </span>
        )}
      </div>

      {error ? (
        <p className="text-[11px] text-[var(--vscode-errorForeground,#f48771)]">{error}</p>
      ) : !tree ? (
        loading ? null : <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">No tree loaded</p>
      ) : (
        <ul
          ref={listRef}
          role="tree"
          aria-label="Correlation tree"
          onKeyDown={onKeyDown}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto text-[11px]"
        >
          {rows.map((row) => (
            <TreeRowView
              key={row.id}
              row={row}
              expanded={(row.kind === 'group' || row.hasChildren) && isExpanded(row.id, row.depth, row.kind)}
              focused={row.id === activeId}
              onFocus={() => setFocusedId(row.id)}
              onToggle={(open) => setExpanded(row.id, open)}
              onActivate={() => activate(row)}
              onOpenNode={onOpenNode}
            />
          ))}
        </ul>
      )}

      {tree && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--vscode-descriptionForeground)]" aria-hidden="true">
          {(['A', 'B', 'C', 'F'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <StatusDot status={s} /> {STATUS[s].label}
            </span>
          ))}
        </div>
      )}

      {selected && (
        <CorrelationNodeDialog node={selected} onClose={() => setSelected(null)} onOpenNode={onOpenNode} />
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-default disabled:opacity-50"
    >
      {children}
      {label}
    </button>
  );
}

function StatusDot({ status }: { status: string | null | undefined }) {
  const s = status ? STATUS[status] : undefined;
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: s?.color ?? 'var(--vscode-descriptionForeground)' }}
      title={s?.label ?? status ?? 'Unknown status'}
    />
  );
}

function TreeRowView({
  row,
  expanded,
  focused,
  onFocus,
  onToggle,
  onActivate,
  onOpenNode,
}: {
  row: TreeRow;
  expanded: boolean;
  focused: boolean;
  onFocus: () => void;
  onToggle: (open: boolean) => void;
  onActivate: () => void;
  onOpenNode?: CorrelationTreeViewProps['onOpenNode'];
}) {
  const expandable = row.kind === 'group' || row.hasChildren;
  const node = row.kind === 'node' ? row.node : null;
  const state = row.kind === 'group' ? row.state : nodeState(row.node);
  const deeper = node?.currentState && node.ownState && node.currentState !== node.ownState ? node.currentState : null;
  const typeCode = row.kind === 'group' ? row.subFlowType : row.node.subFlowType;
  const status = row.kind === 'group' ? row.status : row.node.status;
  const inGroup = row.kind === 'node' && row.inGroup;
  const title = row.kind === 'group' ? row.flow : inGroup ? memberLabel(row.node) : row.node.flow;
  const accessibleName =
    row.kind === 'group'
      ? `${row.flow}, ${row.members.length} instances in ${state ?? 'unknown state'}`
      : `${row.node.flow}${row.isRoot ? ' (this instance)' : ''}, ${STATUS[status ?? '']?.label ?? 'unknown status'}, state ${state ?? 'unknown'}`;

  return (
    <li
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={expandable ? expanded : undefined}
      aria-label={accessibleName}
      data-row-id={row.id}
      tabIndex={focused ? 0 : -1}
      onFocus={onFocus}
      onClick={onActivate}
      className="group relative flex cursor-pointer items-start gap-1 rounded py-1 pr-1 hover:bg-[var(--vscode-list-hoverBackground)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]"
      style={{ paddingLeft: row.depth * INDENT + 2 }}
    >
      {Array.from({ length: row.depth }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute top-0 bottom-0 border-l border-[var(--vscode-tree-indentGuidesStroke,var(--vscode-panel-border))]"
          style={{ left: i * INDENT + 9 }}
        />
      ))}
      {expandable ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onToggle(!expanded);
          }}
          className="relative z-[1] flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))] hover:text-[var(--vscode-foreground)]"
        >
          {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}
      <span className="mt-1.5">
        <StatusDot status={status} />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate ${inGroup ? 'font-mono text-[10px]' : 'font-medium'}`} title={node?.key ?? undefined}>
            {title}
          </span>
          {row.kind === 'group' && (
            <span className="shrink-0 rounded bg-[var(--vscode-badge-background)] px-1 text-[10px] text-[var(--vscode-badge-foreground)]">
              ×{row.members.length}
            </span>
          )}
          {row.kind === 'node' && row.isRoot && (
            <span className="shrink-0 text-[10px] text-[var(--vscode-descriptionForeground)]">this instance</span>
          )}
          {node?.terminalOutcome === 'faulted' && <XCircle size={12} className="shrink-0 text-[var(--vscode-errorForeground,#f48771)]" aria-label="Faulted" />}
          {node && !node.resolved && (
            <span title={UNRESOLVED_REASON[node.unresolvedReason ?? ''] ?? 'Not expanded'} className="shrink-0">
              <AlertTriangle size={12} className="text-[var(--vscode-editorWarning-foreground,#cca700)]" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">
          {state ?? '—'}
          {deeper ? ` → ${deeper}` : ''}
          {node && !node.resolved ? ` · ${UNRESOLVED_REASON[node.unresolvedReason ?? ''] ?? 'Not expanded'}` : ''}
        </div>
      </div>
      {typeCode && !inGroup && (
        <span className="mt-0.5 shrink-0 rounded border border-[var(--vscode-panel-border)] px-1 text-[9px] text-[var(--vscode-descriptionForeground)]">
          {TYPE_LABEL[typeCode] ?? typeCode}
        </span>
      )}
      {row.kind === 'node' && onOpenNode && !row.isRoot && <RowMenu node={row.node} onOpenNode={onOpenNode} />}
    </li>
  );
}

function RowMenu({
  node,
  onOpenNode,
}: {
  node: CorrelationTreeNode;
  onOpenNode: NonNullable<CorrelationTreeViewProps['onOpenNode']>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Actions for ${node.flow}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--vscode-descriptionForeground)] opacity-60 hover:bg-[var(--vscode-list-hoverBackground)] hover:opacity-100 group-hover:opacity-100"
        >
          <MoreHorizontal size={13} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onOpenNode(node, 'quickrun')}>Open Runner</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenNode(node, 'designer')}>Open in Designer</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(node.id)}>Copy instance ID</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : null);

/** Overview of one tree node (exported for the SSR tests). */
export function CorrelationNodeDetails({
  node,
  onOpenNode,
}: {
  node: CorrelationTreeNode;
  onOpenNode?: CorrelationTreeViewProps['onOpenNode'];
}) {
  const status = node.status ? STATUS[node.status]?.label ?? node.status : null;
  return (
    <div className="flex flex-col gap-3">
      <DetailsList
        rows={[
          { label: 'Flow', value: `${node.domain}/${node.flow}${node.flowVersion ? ` v${node.flowVersion}` : ''}` },
          !!node.key && { label: 'Key', value: node.key, copy: node.key, mono: true },
          { label: 'Instance', value: node.id, copy: node.id, mono: true },
          !!status && { label: 'Status', value: status },
          !!node.subFlowType && { label: 'Started as', value: TYPE_LABEL[node.subFlowType] ?? node.subFlowType },
          { label: 'State', value: nodeState(node) ?? '—' },
          !!node.currentState && node.currentState !== nodeState(node) && { label: 'Deepest state', value: node.currentState },
          !!node.parentState && { label: 'Started from', value: node.parentState },
          !!node.correlationId && { label: 'Correlation', value: node.correlationId, copy: node.correlationId, mono: true },
          !!when(node.createdAt) && { label: 'Created', value: when(node.createdAt) },
          !!when(node.stateChangedAt) && { label: 'State changed', value: when(node.stateChangedAt) },
          !!when(node.completedAt) && { label: 'Link closed', value: when(node.completedAt) },
          !!node.terminalOutcome && { label: 'Outcome', value: node.terminalOutcome },
          !node.resolved && { label: 'Not expanded', value: UNRESOLVED_REASON[node.unresolvedReason ?? ''] ?? 'Unknown reason' },
        ]}
      />
      {onOpenNode && (
        <div className="flex gap-2">
          <DialogAction onClick={() => onOpenNode(node, 'quickrun')}>Open Runner</DialogAction>
          <DialogAction onClick={() => onOpenNode(node, 'designer')}>Open in Designer</DialogAction>
        </div>
      )}
    </div>
  );
}

function DialogAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[11px] hover:bg-[var(--vscode-list-hoverBackground)]"
    >
      {children}
    </button>
  );
}

function CorrelationNodeDialog({
  node,
  onClose,
  onOpenNode,
}: {
  node: CorrelationTreeNode;
  onClose: () => void;
  onOpenNode?: CorrelationTreeViewProps['onOpenNode'];
}) {
  return (
    <DetailsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <StatusDot status={node.status} />
          {node.flow}
        </span>
      }
      description={nodeState(node) ?? undefined}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          render: () => (
            <CorrelationNodeDetails
              node={node}
              {...(onOpenNode
                ? {
                    onOpenNode: (n: CorrelationTreeNode, intent: 'quickrun' | 'designer') => {
                      onClose();
                      onOpenNode(n, intent);
                    },
                  }
                : {})}
            />
          ),
        },
      ]}
    />
  );
}
