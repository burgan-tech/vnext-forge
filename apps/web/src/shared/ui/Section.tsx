import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const sectionVariants = cva('rounded-xl border shadow-sm transition-all duration-200 ease-out', {
  variants: {
    variant: {
      default: 'border-primary-border bg-primary text-primary-foreground',
      secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
      tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
      success: 'border-success-border bg-success text-success-foreground',
      muted: 'border-muted-border bg-muted text-muted-foreground',
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
      variant: 'muted',
      hoverable: true,
      className: 'hover:border-muted-border-hover hover:bg-muted-hover',
    },
  ],
  defaultVariants: {
    variant: 'default',
    hoverable: false,
    noBorder: false,
  },
});

const sectionIconVariants = cva('mt-0.5 shrink-0 transition-colors', {
  variants: {
    variant: {
      default: 'text-primary-icon',
      secondary: 'text-secondary-icon',
      tertiary: 'text-tertiary-icon',
      success: 'text-success-icon',
      muted: 'text-muted-icon',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const sectionToggleButtonVariants = cva(
  'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary-muted text-primary-icon',
        secondary: 'border-secondary-border bg-secondary-muted text-secondary-icon',
        tertiary: 'border-tertiary-border bg-tertiary-muted text-tertiary-icon',
        success: 'border-success-border bg-success-surface text-success-icon',
        muted: 'border-muted-border bg-muted-surface text-muted-icon',
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
        className: 'hover:border-primary-border-hover hover:bg-primary-muted-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-muted-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-muted-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

const sectionCountVariants = cva('rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums', {
  variants: {
    variant: {
      default: 'border-primary-border bg-primary-muted text-primary-icon',
      secondary: 'border-secondary-border bg-secondary-muted text-secondary-icon',
      tertiary: 'border-tertiary-border bg-tertiary-muted text-tertiary-icon',
      success: 'border-success-border bg-success-surface text-success-icon',
      muted: 'border-muted-border bg-muted-surface text-muted-icon',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface SectionProps
  extends Omit<React.ComponentProps<'div'>, 'title'>, VariantProps<typeof sectionVariants> {
  action?: React.ReactNode;
  collapsible?: boolean;
  count?: React.ReactNode;
  defaultOpen?: boolean;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
}

function Section({
  action,
  children,
  className,
  collapsible = false,
  count,
  defaultOpen = true,
  description,
  hoverable,
  icon,
  noBorder,
  title,
  variant,
  ...props
}: SectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const content = !collapsible || isOpen ? <div className="px-4 pb-4">{children}</div> : null;
  const resolvedVariant = variant ?? 'default';

  return (
    <section
      data-slot="section"
      className={cn(sectionVariants({ variant, hoverable, noBorder }), className)}
      {...props}>
      <div className="flex items-start gap-3 px-4 py-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className={cn(
              sectionToggleButtonVariants({ variant: resolvedVariant, hoverable: true }),
            )}
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}>
            <ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} />
          </button>
        ) : icon ? (
          <div className={sectionIconVariants({ variant: resolvedVariant })}>{icon}</div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!collapsible && icon ? null : collapsible && icon ? (
              <span className={cn(sectionIconVariants({ variant: resolvedVariant }), 'mt-0')}>
                {icon}
              </span>
            ) : null}
            <h3 className="text-sm font-semibold">{title}</h3>
            {count ? (
              <span className={sectionCountVariants({ variant: resolvedVariant })}>{count}</span>
            ) : null}
          </div>
          {description ? <p className="mt-1 text-xs text-current/70">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {content}
    </section>
  );
}

export { Section, sectionVariants };
