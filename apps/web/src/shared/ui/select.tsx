import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const selectVariants = cva(
  'flex h-10 w-full rounded-md border px-3 text-sm shadow-xs transition-all duration-200 ease-out outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground focus-visible:border-primary-border-hover focus-visible:ring-ring/50',
        secondary:
          'border-secondary-border bg-secondary text-secondary-foreground focus-visible:border-secondary-border-hover focus-visible:ring-ring/50',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-foreground focus-visible:border-tertiary-border-hover focus-visible:ring-ring/50',
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
      hoverable: true,
      noBorder: false,
    },
  },
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & VariantProps<typeof selectVariants>;

const Select = ({ className, children, hoverable, noBorder, variant, ...props }: SelectProps) => {
  return (
    <select
      className={cn(
        selectVariants({ variant, hoverable, noBorder }),
        className,
      )}
      {...props}>
      {children}
    </select>
  );
};

export { Select, selectVariants };
