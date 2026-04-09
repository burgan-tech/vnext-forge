import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon } from 'lucide-react';

import { cn } from '@shared/lib/utils/Cn';

const checkboxVariants = cva(
  'peer size-4 shrink-0 rounded-[4px] border shadow-xs transition-all duration-200 ease-out outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:text-current',
  {
    variants: {
      variant: {
        default:
          'border-primary-border bg-primary text-primary-icon data-[state=checked]:border-primary-border data-[state=checked]:bg-primary-muted',
        secondary:
          'border-secondary-border bg-secondary text-secondary-icon data-[state=checked]:border-secondary-border data-[state=checked]:bg-secondary-muted',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-icon data-[state=checked]:border-tertiary-border data-[state=checked]:bg-tertiary-muted',
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
        className:
          'hover:border-primary-border-hover hover:bg-primary-hover data-[state=checked]:hover:border-primary-border-hover data-[state=checked]:hover:bg-primary-muted-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:border-secondary-border-hover hover:bg-secondary-hover data-[state=checked]:hover:border-secondary-border-hover data-[state=checked]:hover:bg-secondary-muted-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:border-tertiary-border-hover hover:bg-tertiary-hover data-[state=checked]:hover:border-tertiary-border-hover data-[state=checked]:hover:bg-tertiary-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

function Checkbox({
  className,
  variant,
  hoverable,
  noBorder,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant, hoverable, noBorder }), className)}
      {...props}>
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none">
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox, checkboxVariants };
