import { useState, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '../lib/utils/cn.js';
import { Card, CardContent } from './Card';
import { Badge } from './Badge';

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
  icon?: ReactNode;
  badge?: string;
  badgeClassName?: string;
}

export type AccordionDensity = 'default' | 'inline';

export interface AccordionProps {
  items: AccordionItem[];
  className?: string;
  allowMultiple?: boolean;
  defaultOpenItemIds?: string[];
  variant?: VariantProps<typeof accordionItemVariants>['variant'];
  hoverable?: boolean;
  surfaceHoverable?: boolean;
  noBorder?: boolean;
  /**
   * `inline`: dar yan paneller / gömülü bloklar — daha küçük padding, tipografi ve ikon.
   * `default`: mevcut kart görünümü (Test sayfası vb.).
   */
  density?: AccordionDensity;
  /**
   * `true`: primary/secondary yüzey token’ları yerine nötr `border` / `background` (ayarlar sütunu vb.).
   */
  chrome?: boolean;
}

const accordionItemVariants = cva(
  'overflow-hidden border py-0 shadow-sm transition-[background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none',
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
  'flex w-full cursor-pointer items-center justify-between rounded-[calc(var(--radius-xl)-0.125rem)] border px-5 py-4 text-left shadow-sm transition-[background-color,border-color,box-shadow,color] duration-300 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
        className:
          'hover:border-primary-border-hover hover:bg-primary-hover hover:shadow-md motion-reduce:hover:shadow-sm',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:border-secondary-border-hover hover:bg-secondary-hover hover:shadow-md motion-reduce:hover:shadow-sm',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:border-tertiary-border-hover hover:bg-tertiary-hover hover:shadow-md motion-reduce:hover:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

const accordionIconVariants = cva(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none',
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
          'group-hover/accordion:bg-primary-muted-hover group-hover/accordion:shadow-sm',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'group-hover/accordion:bg-secondary-muted-hover group-hover/accordion:shadow-sm',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'group-hover/accordion:bg-tertiary-muted-hover group-hover/accordion:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

const accordionChevronVariants = cva(
  'h-5 w-5 shrink-0 transition-[color,transform] duration-300 ease-out motion-reduce:transition-none',
  {
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
      className:
        'group-hover/accordion:text-primary-text group-hover/accordion:translate-x-px motion-reduce:group-hover/accordion:translate-x-0',
    },
    {
      variant: 'secondary',
      hoverable: true,
      className:
        'group-hover/accordion:text-secondary-text group-hover/accordion:translate-x-px motion-reduce:group-hover/accordion:translate-x-0',
    },
    {
      variant: 'tertiary',
      hoverable: true,
      className:
        'group-hover/accordion:text-tertiary-text group-hover/accordion:translate-x-px motion-reduce:group-hover/accordion:translate-x-0',
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
  density = 'default',
  chrome = false,
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

  const isInline = density === 'inline';

  return (
    <div className={cn(isInline ? 'space-y-1.5' : 'space-y-4', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id);

        const itemSurface = chrome
          ? cn(
              'overflow-hidden border py-0 shadow-sm transition-[box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none',
              'border-border bg-card text-foreground',
              isInline ? 'rounded-lg' : 'rounded-xl',
              noBorder && 'border-0',
            )
          : cn(
              accordionItemVariants({ variant, hoverable: surfaceHoverable, noBorder }),
              isInline && 'rounded-lg',
            );

        const triggerSurface = chrome
          ? cn(
              'group/accordion flex w-full cursor-pointer items-center justify-between text-left',
              'border border-border/50 bg-muted/35 text-foreground shadow-none',
              'transition-[background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isInline
                ? 'rounded-lg px-2.5 py-2'
                : 'rounded-[calc(var(--radius-xl)-0.125rem)] px-5 py-4 shadow-sm',
              hoverable &&
                'hover:border-border hover:bg-muted/50 hover:shadow-sm active:bg-muted/55 motion-reduce:hover:shadow-none',
            )
          : cn(
              'group/accordion',
              accordionTriggerVariants({ variant, hoverable }),
              isInline && 'px-2.5 py-2',
            );

        const iconSurface = chrome
          ? cn(
              'flex shrink-0 items-center justify-center',
              'bg-muted text-foreground',
              'transition-[background-color,color] duration-300 ease-out motion-reduce:transition-none',
              isInline ? 'h-7 w-7 rounded-md' : 'h-10 w-10 rounded-xl',
              hoverable &&
                'group-hover/accordion:bg-muted/90 group-hover/accordion:text-foreground',
            )
          : cn(
              accordionIconVariants({ variant, hoverable }),
              isInline && 'h-7 w-7 rounded-md',
            );

        const chevronSurface = chrome
          ? cn(
              'shrink-0 transition-[color,transform] duration-300 ease-out motion-reduce:transition-none',
              isInline ? 'h-4 w-4' : 'h-5 w-5',
              'text-muted-foreground',
              isOpen && 'rotate-180',
              hoverable && 'group-hover/accordion:text-foreground/95',
            )
          : cn(
              accordionChevronVariants({ variant, hoverable, open: isOpen }),
              isInline && 'h-4 w-4',
            );

        const titleClass = cn(
          'text-current',
          isInline ? 'text-xs font-semibold' : 'text-base font-semibold',
        );

        const contentPad = isInline ? 'px-2.5 pb-2.5 pt-0' : 'px-5 pb-5';

        return (
          <Card key={item.id} className={cn(itemSurface, (isInline || chrome) && 'gap-0')}>
            <button type="button" className={triggerSurface} onClick={() => toggleItem(item.id)}>
              <div className={cn('flex items-center', isInline ? 'gap-2' : 'gap-3')}>
                {item.icon ? <div className={iconSurface}>{item.icon}</div> : null}

                <div>
                  <p className={titleClass}>{item.title}</p>
                  {item.badge ? (
                    <Badge
                      variant={chrome ? 'outline' : variant}
                      className={cn(
                        isInline ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs',
                        item.badgeClassName,
                      )}>
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <ChevronDownIcon className={chevronSurface} />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-200 ease-in-out',
                isOpen ? 'max-h-[min(80vh,32rem)] opacity-100' : 'max-h-0 opacity-0',
              )}>
              <CardContent className={contentPad}>{item.content}</CardContent>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default Accordion;
