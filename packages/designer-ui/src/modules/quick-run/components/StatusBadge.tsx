import type { InstanceStatus } from '../types/quickrun.types';

/** Semantic muted surfaces: info (active), warning (running), success (completed), destructive-muted (faulted). */
const STATUS_CONFIG: Record<InstanceStatus, { label: string; className: string }> = {
  A: { label: 'Active', className: 'border-info-border bg-info text-info-foreground' },
  B: { label: 'Running', className: 'border-warning-border bg-warning text-warning-foreground' },
  C: { label: 'Completed', className: 'border-success-border bg-success text-success-foreground' },
  F: { label: 'Failed', className: 'border-destructive-border bg-destructive-muted text-destructive-text' },
};

interface StatusBadgeProps {
  status: InstanceStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {compact ? status : config.label}
    </span>
  );
}
