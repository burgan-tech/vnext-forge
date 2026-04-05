import type { ComponentProps } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { cn } from '@shared/lib/utils/cn';

type SharedToasterProps = ComponentProps<typeof Sonner> & ToasterProps;

const Toaster = ({ className, toastOptions, ...props }: SharedToasterProps) => {
  return (
    <Sonner
      className={cn('toaster group', className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: cn(
            'group toast border-border bg-card text-card-foreground shadow-lg',
            toastOptions?.classNames?.toast,
          ),
          description: cn('text-muted-foreground', toastOptions?.classNames?.description),
          actionButton: cn(
            'bg-primary text-primary-foreground hover:bg-primary/90',
            toastOptions?.classNames?.actionButton,
          ),
          cancelButton: cn(
            'bg-muted text-muted-foreground hover:bg-muted/80',
            toastOptions?.classNames?.cancelButton,
          ),
          error: cn(
            'border-destructive/30 text-destructive',
            toastOptions?.classNames?.error,
          ),
          success: cn('border-green-500/30', toastOptions?.classNames?.success),
          info: cn('border-border', toastOptions?.classNames?.info),
          warning: cn('border-amber-500/30', toastOptions?.classNames?.warning),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
