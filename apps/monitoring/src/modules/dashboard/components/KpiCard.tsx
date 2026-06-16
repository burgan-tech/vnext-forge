import { type ReactNode } from 'react';
import { cn } from '@monitoring/shared/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'warning';
  className?: string;
}

export function KpiCard({ label, value, icon, onClick, variant = 'default', className }: KpiCardProps) {
  const isClickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm',
        isClickable && 'cursor-pointer transition-shadow hover:shadow-md',
        variant === 'danger' && isClickable && 'hover:border-destructive/40',
        variant === 'warning' && isClickable && 'hover:border-warning/40',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
    </div>
  );
}
