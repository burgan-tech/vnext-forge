import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils/cn';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';

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
}

const Accordion = ({
  items,
  className,
  allowMultiple = true,
  defaultOpenItemIds = [],
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
            className="border-appBorderColor-200 overflow-hidden border py-0 shadow-sm">
            <button
              type="button"
              className="hover:bg-appHover-50 flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left transition-colors"
              onClick={() => toggleItem(item.id)}>
              <div className="flex items-center gap-3">
                {item.icon ? (
                  <div className="bg-appHover-100 text-appTextHeader flex h-10 w-10 items-center justify-center rounded-full">
                    {item.icon}
                  </div>
                ) : null}

                <div>
                  <p className="text-appTextHeader text-base font-semibold">{item.title}</p>
                  {item.badge ? (
                    <Badge variant="secondary" className={cn('mt-1 text-xs', item.badgeClassName)}>
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {isOpen ? (
                <ChevronUpIcon className="text-appText h-5 w-5" />
              ) : (
                <ChevronDownIcon className="text-appText h-5 w-5" />
              )}
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
