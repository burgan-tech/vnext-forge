import * as React from 'react';
import { AlertTriangle, CircleAlert, Info } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';

import { Button } from './Button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from './Dialog.js';

export type ConfirmAlertDialogTone = 'info' | 'warning' | 'destructive';

const TONE = {
  info: {
    Icon: Info,
    /** Icon only: tinted chip; surface stays neutral. */
    iconWrap: 'bg-info-foreground/10 text-info-foreground',
    titleClass: 'text-info-foreground',
    confirmVariant: 'info' as const,
  },
  warning: {
    Icon: AlertTriangle,
    iconWrap: 'bg-warning-foreground/10 text-warning-foreground',
    titleClass: 'text-warning-foreground',
    confirmVariant: 'warning' as const,
  },
  destructive: {
    Icon: CircleAlert,
    iconWrap: 'bg-destructive-text/10 text-destructive-text',
    titleClass: 'text-destructive-text',
    confirmVariant: 'destructive' as const,
  },
};

export interface ConfirmAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Visual / semantic tone; default `info` reads as a system-style alert. */
  tone?: ConfirmAlertDialogTone;
  className?: string;
}

/**
 * In-app confirmation: neutral dialog shell; tone color only on icon chip + title (and confirm button).
 * Prefer this over `window.alert` / `window.confirm` inside modals and webviews.
 */
export function ConfirmAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  tone = 'info',
  className,
}: ConfirmAlertDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cfg = TONE[tone];
  const Icon = cfg.Icon;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="secondary"
        showCloseButton={false}
        closeInHeader={false}
        hoverable={false}
        overlayClassName="z-[100]"
        className={cn(
          'border-border bg-background !z-[100] max-w-[min(100%-1.5rem,24rem)] gap-0 overflow-hidden border p-0 text-foreground shadow-xl sm:max-w-md',
          className,
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}>
        <div className="flex gap-3 px-5 pt-5 pb-3">
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full [&>svg]:size-5',
              cfg.iconWrap,
            )}
            aria-hidden>
            <Icon />
          </div>
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <DialogTitle
              id={titleId}
              className={cn('text-left text-base font-semibold leading-snug', cfg.titleClass)}>
              {title}
            </DialogTitle>
            <DialogDescription
              id={descriptionId}
              className="text-muted-foreground !px-0 !pb-0 !pt-0 text-left text-sm leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </div>
        <DialogFooter className="border-border bg-muted/25 gap-2 border-t px-4 py-3 sm:justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={cfg.confirmVariant} size="sm" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
