'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';

const labelVariants = cva(
  'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'text-primary-text',
        secondary: 'text-secondary-text',
        tertiary: 'text-tertiary-text',
        destructive: 'text-destructive-text',
        muted: 'text-muted-foreground',
      },
      interactive: {
        true: 'w-fit rounded-md border px-2 py-1 shadow-sm',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        interactive: true,
        className: 'border-primary-border/60 bg-primary-muted/80 text-primary-text',
      },
      {
        variant: 'secondary',
        interactive: true,
        className: 'border-secondary-border/60 bg-secondary-muted/80 text-secondary-text',
      },
      {
        variant: 'tertiary',
        interactive: true,
        className: 'border-tertiary-border/60 bg-tertiary-muted/80 text-tertiary-text',
      },
      {
        variant: 'destructive',
        interactive: true,
        className: 'border-destructive-border/60 bg-destructive-muted/80 text-destructive-text',
      },
    ],
    defaultVariants: {
      variant: 'default',
      interactive: false,
    },
  },
);

function Label({
  className,
  interactive,
  variant,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

export { Label, labelVariants };
