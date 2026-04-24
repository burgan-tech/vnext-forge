import { useState } from 'react';

import { AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';

import { cn, Popover, PopoverContent, PopoverTrigger } from '@vnext-forge/designer-ui';

import {
  StatusBarNotificationLabel,
  statusBarNotificationVariants,
} from './StatusBarNotification';

/** Workspace diagnostics / validation row for the status bar (not React error-boundary state). */
export interface WorkspaceIssuePopoverItem {
  id: string;
  message: string;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface StatusBarWorkspaceIssuesPopoverProps {
  items: WorkspaceIssuePopoverItem[];
}

export function StatusBarWorkspaceIssuesPopover({ items }: StatusBarWorkspaceIssuesPopoverProps) {
  const count = items.length;
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  if (count === 0) return null;

  const label = count === 1 ? '1 issue' : `${count} issues`;

  const toggleExpanded = (id: string) => {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        title="Show workspace issues"
        aria-haspopup="dialog"
        className={cn(
          statusBarNotificationVariants({ variant: 'chip-danger', interactive: true }),
          'gap-1 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out',
        )}>
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <StatusBarNotificationLabel>{label}</StatusBarNotificationLabel>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="flex max-h-[min(18rem,calc(100vh-4rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden p-0 shadow-sm">
        <div className="shrink-0 px-2.5 py-1.5">
          <p className="text-foreground text-xs font-semibold leading-tight">
            {count} workspace {count === 1 ? 'issue' : 'issues'}
          </p>
        </div>
        <ul
          className="min-h-0 flex-1 overflow-y-auto"
          role="list"
          aria-label="Workspace issues">
          {items.map((item, itemIndex) => {
            const lines = item.message.split('\n').filter((l) => l.trim().length > 0);
            const heading = lines[0];
            const details = lines.slice(1);
            const hasExtraDetail = item.detail != null && item.detail !== '';
            const hasExpandable = details.length > 0 || hasExtraDetail;
            const expanded = expandedById[item.id] === true;
            const detailsPanelId = `workspace-issue-details-${item.id}`;

            return (
              <li key={item.id} className={cn(itemIndex > 0 && 'mt-1')}>
                <div className="flex items-start gap-1.5 px-2.5 pb-1.5">
                  <div className="flex shrink-0 items-start gap-0.5 pt-px">
                    <AlertCircle className="text-destructive-icon size-3 shrink-0" aria-hidden />
                    {hasExpandable ? (
                      <button
                        type="button"
                        id={`workspace-issue-details-trigger-${item.id}`}
                        aria-expanded={expanded}
                        aria-controls={detailsPanelId}
                        aria-label={expanded ? 'Hide detail list' : 'Show detail list'}
                        onClick={() => toggleExpanded(item.id)}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-0.5 inline-flex cursor-pointer rounded p-0.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none">
                        <ChevronDown
                          className={cn(
                            'size-3 shrink-0 opacity-80 motion-safe:transition-transform motion-safe:duration-150',
                            expanded && 'motion-safe:-rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-foreground text-xs leading-snug">{heading}</p>
                      {item.action != null ? (
                        <button
                          type="button"
                          onClick={item.action.onClick}
                          className="border-warning-border bg-warning-surface text-warning-text hover:border-warning-border-hover hover:bg-warning-hover focus-visible:ring-ring/50 cursor-pointer inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none">
                          <ExternalLink className="size-2.5" aria-hidden />
                          {item.action.label}
                        </button>
                      ) : null}
                    </div>
                    {hasExpandable && expanded ? (
                      <div
                        id={detailsPanelId}
                        role="region"
                        aria-labelledby={`workspace-issue-details-trigger-${item.id}`}
                        className="mt-1 space-y-0.5">
                            {details.length > 0 ? (
                              <ol className="space-y-px">
                                {details.map((line, idx) => (
                                  <li
                                    key={`${item.id}-${idx}-${line}`}
                                    className="text-muted-foreground flex gap-1.5 font-mono text-[10px] leading-relaxed">
                                    <span className="text-muted-foreground/60 w-3.5 shrink-0 tabular-nums">
                                      {idx + 1}.
                                    </span>
                                    <span className="min-w-0 break-all" title={line}>
                                      {line}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            ) : null}
                            {hasExtraDetail ? (
                              <p
                                className="text-muted-foreground font-mono text-[10px] leading-relaxed break-all"
                                title={item.detail}>
                                {item.detail}
                              </p>
                            ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
