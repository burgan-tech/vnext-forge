import { AlertCircle, ExternalLink } from 'lucide-react';

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatusBarNotificationLabel,
  statusBarNotificationVariants,
} from '@vnext-forge/designer-ui';

export interface ErrorPopoverItem {
  id: string;
  message: string;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface StatusBarErrorIssuesPopoverProps {
  items: ErrorPopoverItem[];
}

export function StatusBarErrorIssuesPopover({ items }: StatusBarErrorIssuesPopoverProps) {
  const count = items.length;
  if (count === 0) return null;

  const label = count === 1 ? '1 hata' : `${count} hata`;

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        title="Hataları göster"
        aria-haspopup="dialog"
        className={cn(
          statusBarNotificationVariants({ variant: 'chip-danger', interactive: true }),
          'gap-1',
        )}>
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <StatusBarNotificationLabel>{label}</StatusBarNotificationLabel>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="flex max-h-[min(20rem,calc(100vh-4rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
        <div className="border-border shrink-0 border-b px-3 py-2">
          <p className="text-foreground text-sm font-medium">
            {count} {count === 1 ? 'hata' : 'hata'} bulundu
          </p>
        </div>
        <ul
          className="min-h-0 flex-1 overflow-y-auto"
          role="list"
          aria-label="Hata listesi">
          {items.map((item) => {
            const lines = item.message.split('\n').filter((l) => l.trim().length > 0);
            const heading = lines[0];
            const details = lines.slice(1);

            return (
              <li
                key={item.id}
                className="border-border-subtle border-b last:border-b-0">
                <div className="flex items-start gap-2 px-3 py-2">
                  <AlertCircle className="text-destructive-icon mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-foreground text-sm leading-snug">{heading}</p>
                      {item.action != null ? (
                        <button
                          type="button"
                          onClick={item.action.onClick}
                          className="border-warning-border bg-warning-surface text-warning-text hover:border-warning-border-hover hover:bg-warning-hover focus-visible:ring-ring/50 mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none">
                          <ExternalLink className="size-3" aria-hidden />
                          {item.action.label}
                        </button>
                      ) : null}
                    </div>
                    {details.length > 0 ? (
                      <ol className="mt-1 space-y-0.5">
                        {details.map((line, idx) => (
                          <li
                            key={line}
                            className="text-muted-foreground flex gap-1.5 font-mono text-xs leading-relaxed">
                            <span className="text-muted-foreground/60 shrink-0">{idx + 1}.</span>
                            <span className="min-w-0 truncate" title={line}>
                              {line}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {item.detail != null && item.detail !== '' ? (
                      <p
                        className="text-muted-foreground mt-0.5 truncate font-mono text-xs"
                        title={item.detail}>
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
