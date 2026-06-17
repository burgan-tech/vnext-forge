import { useNavigate } from 'react-router-dom';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { config } from '@monitoring/shared/config/config';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
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
          onClick={() => navigate('/faults')}
          className="h-7 px-2 text-xs"
        >
          View all →
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !data?.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No recent faults
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Instance Key
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Workflow
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  State
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Error
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((instance) => (
                <tr
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}?workflow=${instance.workflow}&domain=${instance.domain || config.domain}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-destructive">
                      {instance.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{instance.workflowName}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{instance.state}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="truncate text-xs text-muted-foreground">
                      {instance.err ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(instance.updatedAt || instance.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
