import { useCallback, useState, type ReactNode } from 'react';

import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import type { CorrelationInfo, OpenSubFlowTarget } from '../types/quickrun.types';
import { CopyIdButton } from './CopyIdButton';

type CorrelationView = 'active' | 'all';

export interface CorrelationsTabContentProps {
  /** Open correlations — every engine version sends these. */
  activeCorrelations: CorrelationInfo[] | undefined;
  /**
   * Open *and* closed correlations, with lifecycle detail. Newer engine
   * versions only; when absent the Active/All switch is not rendered at all.
   */
  correlations: CorrelationInfo[] | undefined;
  /** Omitted by hosts that cannot navigate — the row actions are then hidden. */
  onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void;
}

/**
 * Correlations between this instance and the sub-flows it started.
 *
 * Props rather than store reads: this package's test harness is SSR-only
 * (`renderToStaticMarkup`), where zustand serves the snapshot frozen at store
 * creation — the same reason `RawTabContent` takes props.
 */
export function CorrelationsTabContent({
  activeCorrelations,
  correlations,
  onOpenSubFlowTarget,
}: CorrelationsTabContentProps) {
  const [view, setView] = useState<CorrelationView>('active');
  const resolveWorkflowFile = useWorkflowFileResolver();

  const hasAll = (correlations?.length ?? 0) > 0;
  // The two arrays are kept as distinct sources rather than deriving "active"
  // from `correlations`: the engine decides what counts as active.
  const shown = hasAll && view === 'all' ? (correlations ?? []) : (activeCorrelations ?? []);

  const openSubFlow = useCallback(
    (correlation: CorrelationInfo, intent: OpenSubFlowTarget['intent']): void => {
      if (!onOpenSubFlowTarget) return;
      // Unresolvable references (different domain, file missing) are reported
      // by the resolver as warning notifications.
      void resolveWorkflowFile(correlation.subFlowName, correlation.subFlowDomain).then((resolved) => {
        if (!resolved) return;
        onOpenSubFlowTarget({
          intent,
          domain: correlation.subFlowDomain,
          workflowKey: correlation.subFlowName,
          workflowFilePath: resolved.path,
          ...(resolved.route ? { route: resolved.route } : {}),
        });
      });
    },
    [onOpenSubFlowTarget, resolveWorkflowFile],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {hasAll && (
        <div className="flex items-center gap-1" role="group" aria-label="Correlation filter">
          <FilterButton selected={view === 'active'} onClick={() => setView('active')}>
            Active
          </FilterButton>
          <FilterButton selected={view === 'all'} onClick={() => setView('all')}>
            All ({correlations?.length ?? 0})
          </FilterButton>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-[var(--vscode-descriptionForeground)]">
          {view === 'all' ? 'No correlations' : 'No active correlations'}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto min-h-0">
          {shown.map((c) => (
            <CorrelationCard
              key={c.correlationId}
              correlation={c}
              {...(onOpenSubFlowTarget ? { onOpenSubFlow: openSubFlow } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
        selected
          ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
          : 'border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      {children}
    </button>
  );
}

function CorrelationCard({
  correlation: c,
  onOpenSubFlow,
}: {
  correlation: CorrelationInfo;
  onOpenSubFlow?: (correlation: CorrelationInfo, intent: OpenSubFlowTarget['intent']) => void;
}) {
  return (
    <div className="rounded border border-[var(--vscode-panel-border)] p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium" title={c.subFlowName}>{c.subFlowName}</span>
        <span
          className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
            c.isCompleted
              ? 'bg-[var(--vscode-charts-green)] text-white'
              : 'bg-[var(--vscode-charts-blue)] text-white'
          }`}
        >
          {c.isCompleted
            ? c.terminalOutcome
              ? `Completed · ${c.terminalOutcome}`
              : 'Completed'
            : 'Active'}
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <span>Domain: {c.subFlowDomain}</span>
        <span>Type: {c.subFlowType} v{c.subFlowVersion}</span>
        <span>Parent State: {c.parentState}</span>
        {c.currentState && <span>Sub-Flow State: {c.currentState}</span>}
        {c.createdAt && <span>Created: {formatTimestamp(c.createdAt)}</span>}
        {c.stateChangedAt && <span>State Changed: {formatTimestamp(c.stateChangedAt)}</span>}
        {c.completedAt && <span>Completed At: {formatTimestamp(c.completedAt)}</span>}
      </div>

      <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <IdRow label="Instance" value={c.subFlowInstanceId} copyLabel="sub-flow instance ID" />
        <IdRow label="Correlation" value={c.correlationId} copyLabel="correlation ID" />
      </div>

      {onOpenSubFlow && (
        <div className="mt-2 flex items-center gap-1">
          <RowActionButton onClick={() => onOpenSubFlow(c, 'quickrun')}>
            Open Runner
          </RowActionButton>
          <RowActionButton onClick={() => onOpenSubFlow(c, 'designer')}>
            Open in Designer
          </RowActionButton>
        </div>
      )}
    </div>
  );
}

/** Full id — never truncated — plus its copy button. */
function IdRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <span className="flex items-start gap-1">
      <span className="shrink-0">{label}:</span>
      <code className="break-all font-mono text-[10px] text-[var(--vscode-textLink-foreground)]">
        {value}
      </code>
      {value ? <CopyIdButton value={value} label={copyLabel} /> : null}
    </span>
  );
}

function RowActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
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

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
