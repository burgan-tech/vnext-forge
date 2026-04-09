import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const summaryCardVariants = cva(
  'rounded-xl border p-4 text-center shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        success: 'border-success-border bg-success text-success-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
        muted: 'border-muted-border bg-muted text-muted-foreground',
      },
      hoverable: {
        true: '',
        false: '',
      },
      noBorder: {
        true: 'border-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        hoverable: true,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

interface SummaryCardProps extends React.ComponentProps<'div'>, VariantProps<typeof summaryCardVariants> {
  label: React.ReactNode;
  toneClassName?: string;
  value: React.ReactNode;
}

function SummaryCard({
  className,
  hoverable,
  label,
  noBorder,
  toneClassName,
  value,
  variant,
  ...props
}: SummaryCardProps) {
  return (
    <div
      data-slot="summary-card"
      className={cn(summaryCardVariants({ variant, hoverable, noBorder }), toneClassName, className)}
      {...props}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-medium text-current/70">{label}</div>
    </div>
  );
}

export { SummaryCard, summaryCardVariants };
