import type { InstanceStatus } from '../types/quickrun.types';

const STATUS_CONFIG: Record<InstanceStatus, { label: string; className: string }> = {
  A: { label: 'Active', className: 'bg-[var(--vscode-charts-yellow)] text-black' },
  B: { label: 'Running', className: 'bg-[var(--vscode-charts-blue)] text-white' },
  C: { label: 'Completed', className: 'bg-[var(--vscode-charts-green)] text-white' },
  F: { label: 'Failed', className: 'bg-[var(--vscode-errorForeground)] text-white' },
};

interface StatusBadgeProps {
  status: InstanceStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${config.className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {compact ? status : config.label}
    </span>
  );
}
