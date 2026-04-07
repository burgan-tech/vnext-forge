import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';
import Loading from '@shared/ui/loading';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs',
        destructive:
          'bg-destructive text-white shadow-xs focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs dark:bg-input/30 dark:border-input',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs',
        ghost: '',
        link: 'text-primary underline-offset-4',
      },
      size: {
        default: 'min-h-9',
        sm: 'min-h-8 rounded-md',
        lg: 'min-h-10 rounded-md',
        icon: 'size-9',
      },
      hoverable: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        hoverable: true,
        className: 'hover:bg-primary/90',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'hover:bg-destructive/90',
      },
      {
        variant: 'outline',
        hoverable: true,
        className: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-input/50',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:bg-secondary/80',
      },
      {
        variant: 'ghost',
        hoverable: true,
        className: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
      },
      {
        variant: 'link',
        hoverable: true,
        className: 'hover:underline',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      hoverable: true,
    },
  },
);

const buttonContentVariants = cva('inline-flex items-center justify-center gap-2', {
  variants: {
    size: {
      default: 'px-4 py-2',
      sm: 'gap-1.5 px-3 py-1.5',
      lg: 'px-6 py-2.5',
      icon: 'size-full',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  hoverable = true,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }) {
  const Comp = asChild ? Slot : 'button';
  const leadingVisual = loading ? (
    <Loading
      config={{
        variant: 'dots',
        size: 'sm',
        showText: false,
        color: variant === 'default' || variant === 'destructive' ? 'white' : 'primary',
      }}
      className="flex-row"
    />
  ) : (
    leftIcon
  );
  const content = (
    <span className={cn(buttonContentVariants({ size }))}>
      {leadingVisual}
      {children}
      {rightIcon}
    </span>
  );

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-loading={loading ? 'true' : 'false'}
        aria-busy={loading}
        className={cn(buttonVariants({ variant, size, hoverable, className }))}
        {...props}>
        {content}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, hoverable, className }))}
      disabled={disabled || loading}
      {...props}>
      {content}
    </Comp>
  );
}

export { Button, buttonVariants };
