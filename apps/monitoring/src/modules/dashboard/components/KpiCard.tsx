import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '@monitoring/shared/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'warning';
  className?: string;
  style?: CSSProperties;
  valueClassName?: string;
}

export function KpiCard({ label, value, icon, onClick, variant = 'default', className, style, valueClassName }: KpiCardProps) {
  const isClickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      style={style}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm',
        isClickable && 'cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
        variant === 'danger' && isClickable && 'hover:border-destructive/40',
        variant === 'warning' && isClickable && 'hover:border-warning/40',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon != null && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={cn('text-3xl font-bold tracking-tight text-foreground', valueClassName)}>{value}</div>
    </div>
  );
}
