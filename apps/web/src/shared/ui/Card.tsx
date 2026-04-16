import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const cardVariants = cva(
  'flex flex-col gap-6 rounded-xl border py-6 shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
        success: 'border-success-border bg-success text-success-foreground',
        info: 'border-info-border bg-info text-info-foreground',
        warning: 'border-warning-border bg-warning text-warning-foreground',
        destructive:
          'border-destructive-border bg-destructive-muted text-destructive-text',
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
        variant: 'destructive',
        hoverable: true,
        className: 'hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
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

function Card({
  className,
  variant,
  hoverable,
  noBorder,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-current/70', className)}
      {...props}
    />
  );
}

const cardActionVariants = cva(
  'col-start-2 row-span-2 row-start-1 self-start justify-self-end rounded-xl transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        tertiary: '',
        success: '',
        info: '',
        warning: '',
        destructive: '',
        muted: '',
      },
      interactive: {
        true: 'border px-3 py-2 shadow-sm',
        false: '',
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
        interactive: true,
        className: 'border-primary-border bg-primary-surface text-primary-text',
      },
      {
        variant: 'secondary',
        interactive: true,
        className: 'border-secondary-border bg-secondary-surface text-secondary-text',
      },
      {
        variant: 'tertiary',
        interactive: true,
        className: 'border-tertiary-border bg-tertiary-surface text-tertiary-text',
      },
      {
        variant: 'success',
        interactive: true,
        className: 'border-success-border bg-success-surface text-success-text',
      },
      {
        variant: 'info',
        interactive: true,
        className: 'border-info-border bg-info-surface text-info-text',
      },
      {
        variant: 'warning',
        interactive: true,
        className: 'border-warning-border bg-warning-surface text-warning-text',
      },
      {
        variant: 'destructive',
        interactive: true,
        className: 'border-destructive-border bg-destructive-surface text-destructive-text',
      },
      {
        variant: 'muted',
        interactive: true,
        className: 'border-muted-border bg-muted-surface text-muted-text',
      },
      {
        variant: 'default',
        interactive: true,
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        interactive: true,
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        interactive: true,
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
      {
        variant: 'success',
        interactive: true,
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'info',
        interactive: true,
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-info-border-hover hover:bg-info-hover',
      },
      {
        variant: 'warning',
        interactive: true,
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-warning-border-hover hover:bg-warning-hover',
      },
      {
        variant: 'destructive',
        interactive: true,
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
      },
      {
        variant: 'muted',
        interactive: true,
        hoverable: true,
        className: 'hover:-translate-y-px hover:border-muted-border-hover hover:bg-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      interactive: false,
      hoverable: true,
      noBorder: false,
    },
  },
);

function CardAction({
  className,
  variant,
  interactive,
  hoverable,
  noBorder,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardActionVariants>) {
  return (
    <div
      data-slot="card-action"
      className={cn(cardActionVariants({ variant, interactive, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
};
