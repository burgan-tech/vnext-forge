import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import type { InstanceStatus } from '@monitoring/shared/types';

type TaskExecStatus = 'Success' | 'Failed' | 'Running';
type JobStatus = 'Active' | 'Processed' | 'Failed' | 'Cancelled';

type StatusValue = InstanceStatus | TaskExecStatus | JobStatus;

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

const STATUS_CONFIG: Record<StatusValue, {
  variant: 'info' | 'warning' | 'success' | 'destructive' | 'muted' | 'outline';
  label: string;
  className?: string;
}> = {
  // Instance statuses
  Active:     { variant: 'info',        label: 'Active' },
  Busy:       { variant: 'warning',     label: 'Busy' },
  Completed:  { variant: 'success',     label: 'Completed' },
  Faulted:    { variant: 'destructive', label: 'Faulted' },
  Suspended:  {
    variant: 'outline',
    label: 'Suspended',
    className: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400',
  },
  Terminated: { variant: 'muted', label: 'Terminated' },
  // Task execution statuses
  Success:    { variant: 'success',     label: 'Success' },
  Failed:     { variant: 'destructive', label: 'Failed' },
  Running:    { variant: 'info',        label: 'Running' },
  // Job statuses
  Processed:  { variant: 'success',     label: 'Processed' },
  Cancelled:  { variant: 'muted',       label: 'Cancelled' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const conf = STATUS_CONFIG[status];
  if (!conf) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge
      variant={conf.variant}
      className={cn('font-mono', conf.className, className)}
    >
      {conf.label}
    </Badge>
  );
}
