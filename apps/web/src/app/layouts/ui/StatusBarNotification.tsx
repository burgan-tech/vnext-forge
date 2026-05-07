import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@vnext-forge-studio/designer-ui/lib';

/**
 * Status bar / dark chrome strip: compact pill notifications.
 * - "message" variants: light semantic surfaces (warning, info, …) on brand bar.
 * - "chip-*" variants: translucent semantic chips that read on `--color-brand-surface`.
 */
const statusBarNotificationVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        warning:
          'max-w-[min(28rem,50vw)] min-w-0 gap-1.5 border-warning-border bg-warning-surface text-warning-text',
        info: 'max-w-[min(28rem,50vw)] min-w-0 gap-1.5 border-info-border bg-info-surface text-info-text',
        success:
          'max-w-[min(28rem,50vw)] min-w-0 gap-1.5 border-success-border bg-success-surface text-success-text',
        destructive:
          'max-w-[min(28rem,50vw)] min-w-0 gap-1.5 border-destructive-border bg-destructive-surface text-destructive-text',
        muted:
          'max-w-[min(28rem,50vw)] min-w-0 gap-1.5 border-muted-border bg-muted-surface text-muted-text',
        'info-wide':
          'max-w-[min(36rem,55vw)] min-w-0 gap-2 border-info-border bg-info-surface text-info-text',
        'chip-success':
          'gap-1 border-brand-surface-status-success-border bg-brand-surface-status-success text-brand-surface-status-success-foreground',
        'chip-warning':
          'gap-1 border-brand-surface-status-warning-border bg-brand-surface-status-warning text-brand-surface-status-warning-foreground',
        'chip-danger':
          'gap-1 border-brand-surface-status-danger-border bg-brand-surface-status-danger text-brand-surface-status-danger-foreground',
        'chip-muted':
          'gap-1 border-brand-surface-status-muted-border bg-brand-surface-status-muted text-brand-surface-status-muted-foreground',
      },
      interactive: {
        true: 'cursor-pointer text-left transition-colors duration-150 ease-out disabled:cursor-wait disabled:opacity-70',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'warning',
        interactive: true,
        className:
          'hover:border-warning-border-hover hover:bg-warning-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'info',
        interactive: true,
        className:
          'hover:border-info-border-hover hover:bg-info-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'success',
        interactive: true,
        className:
          'hover:border-success-border-hover hover:bg-success-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'destructive',
        interactive: true,
        className:
          'hover:border-destructive-border-hover hover:bg-destructive-muted-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'muted',
        interactive: true,
        className:
          'hover:border-muted-border-hover hover:bg-muted-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'info-wide',
        interactive: true,
        className:
          'hover:border-info-border-hover hover:bg-info-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'chip-success',
        interactive: true,
        className: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'chip-warning',
        interactive: true,
        className: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
      {
        variant: 'chip-danger',
        interactive: true,
        className:
          'hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface motion-reduce:hover:brightness-100 motion-reduce:active:brightness-100',
      },
      {
        variant: 'chip-muted',
        interactive: true,
        className: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
      },
    ],
    defaultVariants: {
      interactive: false,
    },
  },
);

export type StatusBarNotificationVariant = NonNullable<
  VariantProps<typeof statusBarNotificationVariants>['variant']
>;

type StatusBarNotificationSharedProps = VariantProps<typeof statusBarNotificationVariants> & {
  /** Leading icon or dot; use `text-*-icon` + `size-3.5 shrink-0` on Lucide icons. */
  leading?: React.ReactNode;
  className?: string;
};

type StatusBarNotificationSpanProps = StatusBarNotificationSharedProps &
  React.ComponentPropsWithoutRef<'span'> & {
    asButton?: false;
  };

type StatusBarNotificationButtonProps = StatusBarNotificationSharedProps &
  React.ComponentPropsWithoutRef<'button'> & {
    asButton: true;
  };

export type StatusBarNotificationProps = StatusBarNotificationSpanProps | StatusBarNotificationButtonProps;

function StatusBarNotification({
  variant,
  interactive: interactiveProp,
  leading,
  className,
  children,
  asButton,
  ...rest
}: StatusBarNotificationProps) {
  const interactive =
    interactiveProp ?? Boolean(asButton);

  const classes = cn(
    statusBarNotificationVariants({ variant, interactive }),
    className,
  );

  if (asButton) {
    const { type = 'button', ...buttonRest } = rest as StatusBarNotificationButtonProps;
    return (
      <button type={type} className={classes} {...buttonRest}>
        {leading}
        {children}
      </button>
    );
  }

  return (
    <span className={classes} {...(rest as StatusBarNotificationSpanProps)}>
      {leading}
      {children}
    </span>
  );
}

/**
 * Inline actions inside an `info` / `info-wide` status notification (e.g. Evet / Hayır).
 * Keeps token-backed hover on the parent strip; actions stay compact for the status bar.
 */
function StatusBarNotificationInlineAction({
  className,
  emphasis = 'solid',
  ...props
}: React.ComponentProps<'button'> & {
  emphasis?: 'solid' | 'ghost';
}) {
  const base =
    'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface disabled:opacity-50';
  const solid = 'bg-info text-info-foreground hover:bg-info-hover';
  const ghost = 'opacity-90 hover:bg-info-hover';
  return (
    <button
      type="button"
      className={cn(base, emphasis === 'solid' ? solid : ghost, className)}
      {...props}
    />
  );
}

function StatusBarNotificationLabel({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('min-w-0 truncate', className)} {...props} />;
}

export {
  StatusBarNotification,
  statusBarNotificationVariants,
  StatusBarNotificationInlineAction,
  StatusBarNotificationLabel,
};
