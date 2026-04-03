import * as React from 'react';

import { cn } from '@shared/lib/utils/cn';

interface SummaryCardProps extends React.ComponentProps<'div'> {
  label: React.ReactNode;
  toneClassName?: string;
  value: React.ReactNode;
}

function SummaryCard({
  className,
  label,
  toneClassName,
  value,
  ...props
}: SummaryCardProps) {
  return (
    <div
      data-slot="summary-card"
      className={cn('rounded-xl border p-4 text-center', toneClassName, className)}
      {...props}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}

export { SummaryCard };
