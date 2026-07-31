import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import type { Instance } from '@monitoring/shared/types';

interface RecentFaultsSectionProps {
  data: Instance[] | undefined;
  isLoading: boolean;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface FaultColumn {
  key: string;
  label: string;
  align: 'left' | 'right';
  /** Extra classes for this column's `<td>` (header alignment is derived from `align`). */
  cellClassName?: string;
  render: (instance: Instance) => ReactNode;
}

/** Single source of truth for the header, the data cells and the skeleton cells. */
const COLUMNS: FaultColumn[] = [
  {
    key: 'instanceKey',
    label: 'Instance Key',
    align: 'left',
    render: (instance) => (
      <span className="font-mono text-xs font-medium text-destructive">{instance.key}</span>
    ),
  },
  {
    key: 'workflow',
    label: 'Workflow',
    align: 'left',
    cellClassName: 'text-muted-foreground',
    render: (instance) => instance.workflowName,
  },
  {
    key: 'state',
    label: 'State',
    align: 'left',
    render: (instance) => (
      <span className="font-mono text-xs text-muted-foreground">{instance.state}</span>
    ),
  },
  {
    key: 'error',
    label: 'Error',
    align: 'left',
    cellClassName: 'max-w-xs',
    render: (instance) => (
      <span className="truncate text-xs text-muted-foreground">{instance.err ?? '—'}</span>
    ),
  },
  {
    key: 'time',
    label: 'Time',
    align: 'right',
    cellClassName: 'text-right',
    render: (instance) => (
      <span className="font-mono text-xs text-muted-foreground">
        {formatRelativeTime(instance.updatedAt ?? instance.createdAt)}
      </span>
    ),
  },
];

/** Stable keys for the placeholder rows shown while the fault list loads. */
const SKELETON_ROW_KEYS = ['s1', 's2', 's3'];

export function RecentFaultsSection({ data, isLoading }: RecentFaultsSectionProps) {
  const navigate = useNavigate();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Faults
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { void navigate('/faults'); }}
          className="h-7 px-2 text-xs"
        >
          View all →
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {!isLoading && !data?.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No recent faults
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map(({ key, label, align }) => (
                  <th
                    key={key}
                    className={cn(
                      'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                      align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? SKELETON_ROW_KEYS.map((rowKey) => (
                    <tr key={rowKey} className="border-b border-border last:border-0">
                      {COLUMNS.map(({ key, align }) => (
                        <td key={key} className="px-4 py-3">
                          <Skeleton
                            className={cn('h-4', align === 'right' ? 'ml-auto w-16' : 'w-3/4')}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : (data ?? []).map((instance) => (
                    <tr
                      key={instance.id}
                      onClick={() => { void navigate(`/definitions/workflows/${instance.workflow}/instances/${instance.id}`); }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      {COLUMNS.map(({ key, cellClassName, render }) => (
                        <td key={key} className={cn('px-4 py-3', cellClassName)}>
                          {render(instance)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
