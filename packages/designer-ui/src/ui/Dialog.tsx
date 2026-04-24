import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';
import { Button } from './Button';

const dialogContentVariants = cva(
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-lg duration-200 sm:w-full',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
        success: 'border-success-border bg-success text-success-foreground',
        info: 'border-info-border bg-info text-info-foreground',
        warning: 'border-warning-border bg-warning text-warning-foreground',
        destructive:
          'border-destructive-border bg-destructive-muted text-destructive-text',
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
        variant: 'info',
        hoverable: true,
        className: 'hover:border-info-border-hover hover:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className: 'hover:border-warning-border-hover hover:bg-warning-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

/** Sağ üst, mutlak (legacy `DialogContent` son çocuğu). */
const dialogCloseFloatVariants = cva(
  'absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        secondary: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        tertiary: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        success: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        info: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        warning: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        destructive: 'border-destructive-border bg-destructive-muted text-destructive-icon',
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
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'success',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'info',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'warning',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

/** `DialogHeader` satırındaki X: başlık ile aynı flex hizası (mutlak değil). */
const dialogCloseInHeaderVariants = cva(
  'shrink-0 flex size-9 items-center justify-center self-center rounded-xl border shadow-sm transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        secondary: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        tertiary: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        success: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        info: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        warning: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        destructive: 'border-destructive-border bg-destructive-muted text-destructive-icon',
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
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'success',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'info',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'warning',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'hover:-translate-y-px hover:border-destructive-border-hover hover:bg-destructive-muted-hover hover:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

export interface DialogChromeContextValue {
  contentVariant: NonNullable<VariantProps<typeof dialogContentVariants>['variant']>;
  showCloseButton: boolean;
  closeInHeader: boolean;
  closeButtonHoverable: boolean;
  noBorder: boolean | null | undefined;
}

const DialogChromeContext = React.createContext<DialogChromeContextValue | null>(null);

function useDialogChromeOptional() {
  return React.useContext(DialogChromeContext);
}

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  );
}

function DialogContentFloatClose({
  variant,
  closeButtonHoverable,
  noBorder,
}: Pick<DialogChromeContextValue, 'noBorder' | 'closeButtonHoverable'> & {
  variant: DialogChromeContextValue['contentVariant'];
}) {
  return (
    <DialogPrimitive.Close
      className={cn(
        dialogCloseFloatVariants({ variant, hoverable: closeButtonHoverable, noBorder }),
        'ring-offset-background focus-visible:ring-ring',
      )}>
      <XIcon className="size-4" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );
}

function DialogContentHeaderClose({
  variant,
  closeButtonHoverable,
  noBorder,
}: Pick<DialogChromeContextValue, 'noBorder' | 'closeButtonHoverable'> & {
  variant: DialogChromeContextValue['contentVariant'];
}) {
  return (
    <DialogPrimitive.Close
      type="button"
      className={cn(
        dialogCloseInHeaderVariants({ variant, hoverable: closeButtonHoverable, noBorder }),
        'ring-offset-background focus-visible:ring-ring',
      )}>
      <XIcon className="size-4" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeInHeader = true,
  variant,
  hoverable = false,
  closeButtonHoverable = true,
  noBorder,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** `true` (önerilen): kapatma `DialogHeader` satırında; `false`: eski sağ-üst mutlak X. */
  closeInHeader?: boolean;
  closeButtonHoverable?: boolean;
} & VariantProps<typeof dialogContentVariants>) {
  const resolvedVariant = variant ?? 'default';
  const chrome: DialogChromeContextValue = {
    contentVariant: resolvedVariant,
    showCloseButton,
    closeInHeader,
    closeButtonHoverable,
    noBorder,
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ variant, hoverable, noBorder }), className)}
        {...props}>
        <DialogChromeContext.Provider value={chrome}>
          {children}
          {showCloseButton && !closeInHeader ? (
            <DialogContentFloatClose
              variant={resolvedVariant}
              closeButtonHoverable={closeButtonHoverable}
              noBorder={noBorder}
            />
          ) : null}
        </DialogChromeContext.Provider>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  showClose: showCloseInHeader = true,
  children,
  ...rest
}: React.ComponentProps<'div'> & { showClose?: boolean }) {
  const ctx = useDialogChromeOptional();
  const showX = Boolean(
    ctx?.showCloseButton && showCloseInHeader && ctx.closeInHeader,
  );
  if (!ctx) {
    return (
      <div
        data-slot="dialog-header"
        className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
        {...rest}>
        {children}
      </div>
    );
  }
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'border-border-subtle text-foreground/95 flex w-full min-w-0 flex-row items-center justify-between gap-3 border-b px-4 py-3 text-left',
        className,
      )}
      {...rest}>
      <div className="min-w-0 flex-1">{children}</div>
      {showX ? (
        <DialogContentHeaderClose
          variant={ctx.contentVariant}
          closeButtonHoverable={ctx.closeButtonHoverable}
          noBorder={ctx.noBorder}
        />
      ) : null}
    </div>
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-tight font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

/**
 * `DialogHeader`un altındaki tam genişlik açıklama. Başlık bantı ile aynı yatay padding (varsayılan `px-4`;
 * `className` ile ezebilirsiniz).
 */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-current/70 px-4 pb-3 pt-0 text-sm', className)}
      {...props}
    />
  );
}

function DialogCancelButton({
  className,
  variant = 'secondary',
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogPrimitive.Close asChild>
      <Button className={className} type="button" variant={variant} {...props} />
    </DialogPrimitive.Close>
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogCancelButton,
  DialogTitle,
  DialogDescription,
  dialogContentVariants,
  dialogCloseFloatVariants,
  dialogCloseInHeaderVariants,
  useDialogChromeOptional,
};
