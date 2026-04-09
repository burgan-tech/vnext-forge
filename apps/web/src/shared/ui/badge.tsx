import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 ease-out overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
        success: 'border-success-border bg-success text-success-foreground',
        muted: 'border-muted-border bg-muted text-muted-foreground',
        destructive:
          'border-destructive-border bg-destructive text-white focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline: 'border-border bg-background text-foreground',
      },
      hoverable: {
        true: '',
        false: '',
      },
      interactive: {
        true: 'cursor-pointer shadow-sm',
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
        interactive: true,
        className: 'bg-primary-surface text-primary-text',
      },
      {
        variant: 'secondary',
        interactive: true,
        className: 'bg-secondary-surface text-secondary-text',
      },
      {
        variant: 'tertiary',
        interactive: true,
        className: 'bg-tertiary-surface text-tertiary-text',
      },
      {
        variant: 'success',
        interactive: true,
        className: 'border-success-border bg-success-surface text-success-text',
      },
      {
        variant: 'muted',
        interactive: true,
        className: 'border-muted-border bg-muted-surface text-muted-text',
      },
      {
        variant: 'destructive',
        interactive: true,
        className: 'bg-destructive-surface text-destructive-text',
      },
      {
        variant: 'outline',
        interactive: true,
        className: 'border-primary-border bg-primary-surface text-primary-text',
      },
      {
        variant: 'default',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-primary-border-hover [a&]:hover:bg-primary-hover hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-secondary-border-hover [a&]:hover:bg-secondary-hover hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-tertiary-border-hover [a&]:hover:bg-tertiary-hover hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-success-border-hover [a&]:hover:bg-success-hover hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-muted-border-hover [a&]:hover:bg-muted-hover hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-destructive-border-hover [a&]:hover:bg-destructive-hover hover:border-destructive-border-hover hover:bg-destructive-hover',
      },
      {
        variant: 'outline',
        hoverable: true,
        className:
          'hover:-translate-y-px [a&]:hover:border-primary-border-hover [a&]:hover:bg-outline-hover hover:border-primary-border-hover hover:bg-outline-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      interactive: false,
      noBorder: false,
    },
  },
);

function Badge({
  className,
  variant,
  hoverable,
  interactive,
  noBorder,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  const resolvedInteractive = interactive ?? hoverable ?? false;

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({
          variant,
          hoverable,
          interactive: resolvedInteractive,
          noBorder,
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
