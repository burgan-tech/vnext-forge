import type { ComponentProps } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@vnext-forge-studio/designer-ui/lib';

const toasterSurfaceVariants = cva('border shadow-lg', {
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
  },
  defaultVariants: {
    variant: 'default',
  },
});

const toasterButtonVariants = cva(
  'rounded-md border shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      emphasis: {
        action: 'border-primary-border bg-primary-muted text-primary-foreground',
        cancel: 'border-primary-border bg-primary text-primary-icon',
      },
    },
    compoundVariants: [
      {
        emphasis: 'action',
        className: 'hover:border-primary-border-hover hover:bg-primary-muted-hover',
      },
      {
        emphasis: 'cancel',
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
    ],
    defaultVariants: {
      emphasis: 'action',
    },
  },
);

type SharedToasterProps = ComponentProps<typeof Sonner> &
  ToasterProps &
  VariantProps<typeof toasterSurfaceVariants>;

const Toaster = ({ className, toastOptions, variant, ...props }: SharedToasterProps) => {
  const resolvedVariant = variant ?? 'default';

  return (
    <Sonner
      className={cn('toaster group', className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: cn(
            'group toast',
            toasterSurfaceVariants({ variant: resolvedVariant }),
            toastOptions?.classNames?.toast,
          ),
          description: cn('text-current/70', toastOptions?.classNames?.description),
          actionButton: cn(
            toasterButtonVariants({ emphasis: 'action' }),
            toastOptions?.classNames?.actionButton,
          ),
          cancelButton: cn(
            toasterButtonVariants({ emphasis: 'cancel' }),
            toastOptions?.classNames?.cancelButton,
          ),
          error: cn(
            'border-destructive-border bg-destructive-muted text-destructive-text',
            toastOptions?.classNames?.error,
          ),
          success: cn(
            'border-success-border bg-success-surface text-success-text',
            toastOptions?.classNames?.success,
          ),
          info: cn(
            'border-info-border bg-info-surface text-info-text',
            toastOptions?.classNames?.info,
          ),
          warning: cn(
            'border-warning-border bg-warning-surface text-warning-text',
            toastOptions?.classNames?.warning,
          ),
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toasterSurfaceVariants };
