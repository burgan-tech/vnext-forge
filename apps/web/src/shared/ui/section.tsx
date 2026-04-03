import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@shared/lib/utils/cn';

interface SectionProps extends Omit<React.ComponentProps<'div'>, 'title'> {
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
  icon,
  title,
  ...props
}: SectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const content = !collapsible || isOpen ? <div className="px-4 pb-4">{children}</div> : null;

  return (
    <section
      data-slot="section"
      className={cn('bg-card text-card-foreground rounded-xl border', className)}
      {...props}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 transition-colors"
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          >
            <ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} />
          </button>
        ) : icon ? (
          <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!collapsible && icon ? null : collapsible && icon ? (
              <span className="text-muted-foreground shrink-0">{icon}</span>
            ) : null}
            <h3 className="text-sm font-semibold">{title}</h3>
            {count ? (
              <span className="text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums">
                {count}
              </span>
            ) : null}
          </div>
          {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {content}
    </section>
  );
}

export { Section };
