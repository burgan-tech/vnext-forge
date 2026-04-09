import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/Cn';

const tabsListVariants = cva(
  'inline-flex h-10 w-fit items-center justify-center rounded-lg border p-1 shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
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
