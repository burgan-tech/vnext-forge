import { useState, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils/cn';
import { Card, CardContent } from '@shared/ui/Card';
import { Badge } from '@shared/ui/Badge';

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
  icon?: ReactNode;
  badge?: string;
  badgeClassName?: string;
}

interface AccordionProps {
  items: AccordionItem[];
  className?: string;
  allowMultiple?: boolean;
  defaultOpenItemIds?: string[];
  variant?: VariantProps<typeof accordionItemVariants>['variant'];
  hoverable?: boolean;
  surfaceHoverable?: boolean;
  noBorder?: boolean;
}

const accordionItemVariants = cva(
  'overflow-hidden border py-0 shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
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
      hoverable: false,
      noBorder: false,
    },
  },
);

const accordionTriggerVariants = cva(
  'flex w-full cursor-pointer items-center justify-between rounded-[calc(var(--radius-xl)-0.125rem)] border px-5 py-4 text-left shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary-surface text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary-surface text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary-surface text-tertiary-foreground',
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
        className: 'hover:-translate-y-px hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

const accordionIconVariants = cva(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-primary-muted text-primary-icon',
        secondary: 'bg-secondary-muted text-secondary-icon',
        tertiary: 'bg-tertiary-muted text-tertiary-icon',
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
        className:
          'group-hover/accordion:-translate-y-px group-hover/accordion:bg-primary-muted-hover group-hover/accordion:shadow-sm',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'group-hover/accordion:-translate-y-px group-hover/accordion:bg-secondary-muted-hover group-hover/accordion:shadow-sm',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'group-hover/accordion:-translate-y-px group-hover/accordion:bg-tertiary-muted-hover group-hover/accordion:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

const accordionChevronVariants = cva('h-5 w-5 shrink-0 transition-all duration-200 ease-out', {
  variants: {
    variant: {
      default: 'text-primary-icon',
      secondary: 'text-secondary-icon',
      tertiary: 'text-tertiary-icon',
    },
    hoverable: {
      true: '',
      false: '',
    },
    open: {
      true: 'rotate-180',
      false: '',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      hoverable: true,
      className: 'group-hover/accordion:text-primary-text group-hover/accordion:translate-x-0.5',
    },
    {
      variant: 'secondary',
      hoverable: true,
      className: 'group-hover/accordion:text-secondary-text group-hover/accordion:translate-x-0.5',
    },
    {
      variant: 'tertiary',
      hoverable: true,
      className: 'group-hover/accordion:text-tertiary-text group-hover/accordion:translate-x-0.5',
    },
  ],
  defaultVariants: {
    variant: 'default',
    hoverable: true,
    open: false,
  },
});

const Accordion = ({
  items,
  className,
  allowMultiple = true,
  defaultOpenItemIds = [],
  variant = 'default',
  hoverable = true,
  surfaceHoverable = false,
  noBorder = false,
}: AccordionProps) => {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpenItemIds);

  const toggleItem = (itemId: string) => {
    setOpenItems((prev) => {
      const isOpen = prev.includes(itemId);

      if (isOpen) {
        return prev.filter((id) => id !== itemId);
      }

      if (!allowMultiple) {
        return [itemId];
      }

      return [...prev, itemId];
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id);

        return (
          <Card
            key={item.id}
            className={cn(
              accordionItemVariants({ variant, hoverable: surfaceHoverable, noBorder }),
            )}>
            <button
              type="button"
              className={cn('group/accordion', accordionTriggerVariants({ variant, hoverable }))}
              onClick={() => toggleItem(item.id)}>
              <div className="flex items-center gap-3">
                {item.icon ? (
                  <div className={cn(accordionIconVariants({ variant, hoverable }))}>
                    {item.icon}
                  </div>
                ) : null}

                <div>
                  <p className="text-base font-semibold text-current">{item.title}</p>
                  {item.badge ? (
                    <Badge variant={variant} className={cn('mt-1 text-xs', item.badgeClassName)}>
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <ChevronDownIcon
                className={cn(accordionChevronVariants({ variant, hoverable, open: isOpen }))}
              />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-200 ease-in-out',
                isOpen ? 'max-h-500 opacity-100' : 'max-h-0 opacity-0',
              )}>
              <CardContent className="px-5 pb-5">{item.content}</CardContent>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default Accordion;
