import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';

const tabsListVariants = cva(
  'inline-flex h-10 w-fit items-center justify-center rounded-lg border p-1 shadow-sm transition-all duration-200 ease-out',
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
        className:
          'hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-primary-border bg-primary-muted text-primary-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-primary-border-hover data-[state=active]:bg-primary-hover data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
        secondary:
          'border-secondary-border bg-secondary-muted text-secondary-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-secondary-border-hover data-[state=active]:bg-secondary-hover data-[state=active]:text-secondary-foreground data-[state=active]:shadow-sm',
        tertiary:
          'border-tertiary-border bg-tertiary-muted text-tertiary-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-tertiary-border-hover data-[state=active]:bg-tertiary-hover data-[state=active]:text-tertiary-foreground data-[state=active]:shadow-sm',
        success:
          'border-success-border bg-success-surface text-success-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-success-border-hover data-[state=active]:bg-success-hover data-[state=active]:text-success-foreground data-[state=active]:shadow-sm',
        info:
          'border-info-border bg-info-surface text-info-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-info-border-hover data-[state=active]:bg-info-hover data-[state=active]:text-info-foreground data-[state=active]:shadow-sm',
        warning:
          'border-warning-border bg-warning-surface text-warning-icon shadow-sm focus-visible:ring-ring/50 data-[state=active]:border-warning-border-hover data-[state=active]:bg-warning-hover data-[state=active]:text-warning-foreground data-[state=active]:shadow-sm',
        destructive:
          'border-destructive-border bg-destructive-muted text-destructive-icon shadow-sm focus-visible:ring-destructive/20 data-[state=active]:border-destructive-border-hover data-[state=active]:bg-destructive-hover data-[state=active]:text-destructive-foreground data-[state=active]:shadow-sm',
      },
      hoverable: {
        true: '',
        false: '',
      },
      noBorder: {
        true: 'border-0 data-[state=active]:border-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        hoverable: true,
        className: 'hover:bg-primary-hover hover:text-primary-foreground',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:bg-secondary-hover hover:text-secondary-foreground',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'hover:bg-tertiary-hover hover:text-tertiary-foreground',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'hover:bg-success-hover hover:text-success-foreground',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'hover:bg-info-hover hover:text-info-foreground',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'hover:bg-warning-hover hover:text-warning-foreground',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'hover:bg-destructive-muted-hover hover:text-destructive-text',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  hoverable,
  noBorder,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  hoverable,
  noBorder,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant, hoverable, noBorder }), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('ring-offset-background focus-visible:ring-ring outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
