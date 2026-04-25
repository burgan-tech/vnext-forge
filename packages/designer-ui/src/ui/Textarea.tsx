import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';

const textareaVariants = cva(
  [
    'flex min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
    'shadow-[inset_0_2px_5px_rgba(15,23,42,0.14),inset_0_-1px_0_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.05)]',
    'dark:shadow-[inset_0_3px_12px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.11),0_1px_0_rgba(255,255,255,0.07),0_2px_6px_rgba(0,0,0,0.22)]',
    'transition-[box-shadow,background-color,border-color,opacity] duration-200 ease-out',
    'focus-visible:shadow-[inset_0_2px_6px_rgba(15,23,42,0.11),inset_0_-1px_0_rgba(15,23,42,0.05),0_2px_4px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.07)]',
    'dark:focus-visible:shadow-[inset_0_3px_14px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(255,255,255,0.07),0_3px_12px_rgba(0,0,0,0.32)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border-primary-border bg-primary text-primary-foreground placeholder:text-primary-icon/60 focus-visible:border-primary-border-hover focus-visible:ring-ring/50',
        secondary:
          'border-secondary-border bg-secondary text-secondary-foreground placeholder:text-secondary-icon/60 focus-visible:border-secondary-border-hover focus-visible:ring-ring/50',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-foreground placeholder:text-tertiary-icon/60 focus-visible:border-tertiary-border-hover focus-visible:ring-ring/50',
        success:
          'border-success-border bg-success text-success-foreground placeholder:text-success-icon/60 focus-visible:border-success-border-hover focus-visible:ring-ring/50',
        info:
          'border-info-border bg-info text-info-foreground placeholder:text-info-icon/60 focus-visible:border-info-border-hover focus-visible:ring-ring/50',
        warning:
          'border-warning-border bg-warning text-warning-foreground placeholder:text-warning-icon/60 focus-visible:border-warning-border-hover focus-visible:ring-ring/50',
        muted:
          'border-muted-border bg-muted text-muted-foreground placeholder:text-muted-icon/60 focus-visible:border-muted-border-hover focus-visible:ring-ring/40',
        destructive:
          'border-destructive-border bg-destructive-muted text-destructive-text placeholder:text-destructive-icon/60 focus-visible:border-destructive-border-hover focus-visible:ring-destructive/20',
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
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'hover:border-info-border-hover hover:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'hover:border-warning-border-hover hover:bg-warning-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

function Textarea({
  className,
  hoverable,
  noBorder,
  variant,
  ...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
