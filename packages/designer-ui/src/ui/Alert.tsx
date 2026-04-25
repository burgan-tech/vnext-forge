import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start transition-all duration-200 ease-out [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default:
          'border-primary-border bg-primary text-primary-foreground [&>svg]:text-primary-icon',
        secondary:
          'border-secondary-border bg-secondary text-secondary-foreground [&>svg]:text-secondary-icon',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-foreground [&>svg]:text-tertiary-icon',
        success:
          'border-success-border bg-success text-success-foreground [&>svg]:text-success-icon',
        info: 'border-info-border bg-info text-info-foreground [&>svg]:text-info-icon',
        warning:
          'border-warning-border bg-warning text-warning-foreground [&>svg]:text-warning-icon',
        muted: 'border-muted-border bg-muted text-muted-foreground [&>svg]:text-muted-icon',
        destructive:
          'border-destructive-border bg-destructive text-white [&>svg]:text-white *:data-[slot=alert-description]:text-white/90',
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
        className: 'hover:border-destructive-border-hover hover:bg-destructive-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

function Alert({
  className,
  variant,
  hoverable,
  noBorder,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-current/80 [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

const alertActionVariants = cva(
  'inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary-surface text-primary-text',
        secondary: 'border-secondary-border bg-secondary-surface text-secondary-text',
        tertiary: 'border-tertiary-border bg-tertiary-surface text-tertiary-text',
        success: 'border-success-border bg-success-surface text-success-text',
        info: 'border-info-border bg-info-surface text-info-text',
        warning: 'border-warning-border bg-warning-surface text-warning-text',
        muted: 'border-muted-border bg-muted-surface text-muted-text',
        destructive: 'border-destructive-border bg-destructive-surface text-destructive-text',
      },
      hoverable: {
        true: 'cursor-pointer',
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
        className: 'hover:-translate-y-px hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-info-border-hover hover:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-warning-border-hover hover:bg-warning-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-hover hover:text-white',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

function AlertAction({
  className,
  variant,
  hoverable,
  noBorder,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof alertActionVariants>) {
  return (
    <button
      data-slot="alert-action"
      type="button"
      className={cn(alertActionVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
