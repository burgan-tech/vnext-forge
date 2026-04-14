import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';
import Loading from '@shared/ui/Loading';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'border border-primary-border bg-primary text-primary-foreground shadow-xs',
        success: 'border border-success-border bg-success text-success-foreground shadow-xs',
        destructive:
          'border border-destructive-border bg-destructive text-white shadow-xs focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline: 'border border-border bg-background shadow-xs',
        secondary:
          'border border-secondary-border bg-secondary text-secondary-foreground shadow-xs',
        tertiary: 'border border-tertiary-border bg-tertiary text-tertiary-foreground shadow-xs',
        muted: 'border border-muted-border bg-muted text-muted-foreground shadow-xs',
        ghost: 'border border-transparent',
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
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'hover:border-destructive-border-hover hover:bg-destructive-hover',
      },
      {
        variant: 'outline',
        hoverable: true,
        className: 'hover:border-primary-border-hover hover:bg-outline-hover',
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
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        variant: 'ghost',
        hoverable: true,
        className: 'hover:bg-ghost-hover',
      },
      {
        variant: 'link',
        hoverable: true,
        className: 'hover:text-link-hover hover:underline',
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

const buttonIconWrapperClassName =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ease-out';

const buttonIconMotionVariants = cva('', {
  variants: {
    side: {
      left: '',
      right: '',
    },
    hoverable: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      side: 'left',
      hoverable: true,
      className: 'group-hover/button:-translate-y-px group-hover/button:shadow-sm',
    },
    {
      side: 'right',
      hoverable: true,
      className: 'group-hover/button:translate-x-0.5',
    },
  ],
  defaultVariants: {
    side: 'left',
    hoverable: true,
  },
});

const buttonIconVariants = cva(buttonIconWrapperClassName, {
  variants: {
    variant: {
      default: 'bg-primary-muted text-primary-icon',
      success: 'bg-success-surface text-success-icon',
      destructive: 'bg-destructive/10 text-destructive-icon',
      outline: 'bg-accent text-outline-icon',
      secondary: 'bg-secondary-muted text-secondary-icon',
      tertiary: 'bg-tertiary-muted text-tertiary-icon',
      muted: 'bg-muted-surface text-muted-icon',
      ghost: 'bg-accent text-ghost-icon',
      link: 'bg-transparent text-link-icon',
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
      className: 'group-hover/button:bg-primary-muted-hover',
    },
    {
      variant: 'success',
      hoverable: true,
      className: 'group-hover/button:bg-success-hover',
    },
    {
      variant: 'destructive',
      hoverable: true,
      className: 'group-hover/button:bg-destructive/15',
    },
    {
      variant: 'outline',
      hoverable: true,
      className: 'group-hover/button:bg-accent/80',
    },
    {
      variant: 'secondary',
      hoverable: true,
      className: 'group-hover/button:bg-secondary-muted-hover',
    },
    {
      variant: 'tertiary',
      hoverable: true,
      className: 'group-hover/button:bg-tertiary-muted-hover',
    },
    {
      variant: 'muted',
      hoverable: true,
      className: 'group-hover/button:bg-muted-hover',
    },
    {
      variant: 'ghost',
      hoverable: true,
      className: 'group-hover/button:bg-accent/80',
    },
  ],
  defaultVariants: {
    variant: 'default',
    hoverable: true,
  },
});

function renderWrappedIcon(
  icon: React.ReactNode | undefined,
  variant?: VariantProps<typeof buttonVariants>['variant'],
  side: 'left' | 'right' = 'left',
  hoverable?: boolean,
) {
  if (!icon) {
    return null;
  }

  return (
    <span
      className={cn(
        buttonIconVariants({ variant, hoverable }),
        buttonIconMotionVariants({ side, hoverable }),
      )}>
      {icon}
    </span>
  );
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  hoverable = true,
  noBorder = false,
  noIconHover = false,
  leftIcon,
  rightIcon,
  leftIconComponent,
  rightIconComponent,
  leftIconVariant,
  rightIconVariant,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    noBorder?: boolean;
    noIconHover?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    leftIconComponent?: React.ReactNode;
    rightIconComponent?: React.ReactNode;
    leftIconVariant?: VariantProps<typeof buttonVariants>['variant'];
    rightIconVariant?: VariantProps<typeof buttonVariants>['variant'];
  }) {
  const Comp = asChild ? Slot : 'button';
  const loadingColor = variant === 'destructive' ? 'white' : 'primary';
  const resolvedVariant = variant ?? 'default';
  const iconHoverable = Boolean(hoverable) && !noIconHover;
  const leadingVisual = loading ? (
    <Loading
      config={{
        variant: 'dots',
        size: 'sm',
        showText: false,
        color: loadingColor,
      }}
      className="flex-row"
    />
  ) : leftIconComponent ? (
    leftIconComponent
  ) : (
    renderWrappedIcon(leftIcon, leftIconVariant ?? resolvedVariant, 'left', iconHoverable)
  );
  const content = (
    <span className={cn(buttonContentVariants({ size }))}>
      {leadingVisual}
      {children}
      {rightIconComponent
        ? rightIconComponent
        : renderWrappedIcon(rightIcon, rightIconVariant ?? resolvedVariant, 'right', iconHoverable)}
    </span>
  );

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-loading={loading ? 'true' : 'false'}
        aria-busy={loading}
        className={cn(
          buttonVariants({ variant, size, hoverable }),
          noBorder && 'border-0',
          className,
        )}
        {...props}>
        {content}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, hoverable }),
        noBorder && 'border-0',
        className,
      )}
      disabled={disabled || loading}
      {...props}>
      {content}
    </Comp>
  );
}

export { Button, buttonVariants };
