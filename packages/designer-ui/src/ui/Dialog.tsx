import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';
import { Button } from './Button';
import { useResizableGeometry } from './useResizableGeometry';

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
  /**
   * Forwarded from `DialogContent`. When true, `DialogHeader` adds the
   * `data-dialog-handle="drag"` marker + a `cursor: move` style so the
   * user can drag the modal by its header band — same UX as the custom
   * `ResizableDialogShell`.
   */
  resizable: boolean;
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
  overlayClassName,
  enableResize = false,
  resizeStorageKey,
  resizeDefaultWidth,
  resizeDefaultHeight,
  resizeMinWidth,
  resizeMinHeight,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** `true` (önerilen): kapatma `DialogHeader` satırında; `false`: eski sağ-üst mutlak X. */
  closeInHeader?: boolean;
  closeButtonHoverable?: boolean;
  /** Overlay only: use a higher z-index when stacking dialogs (e.g. alert over editor modal). */
  overlayClassName?: string;
  /**
   * When `true`, the dialog frame becomes fully user-resizable: 8 edge
   * / corner drag handles, drag-move from the header (any element with
   * `data-dialog-handle="drag"`), and persistence to localStorage when
   * `resizeStorageKey` is provided. This replaces the previous native
   * CSS `resize` shortcut so behaviour matches `ResizableDialogShell`
   * (used by `TransitionDialog`, `NewRunDialog`, `HeadersConfigDialog`).
   */
  enableResize?: boolean;
  /** Persisted geometry key (e.g. `vnext-forge.dialog.component-editor`). */
  resizeStorageKey?: string;
  resizeDefaultWidth?: number;
  resizeDefaultHeight?: number;
  resizeMinWidth?: number;
  resizeMinHeight?: number;
} & VariantProps<typeof dialogContentVariants>) {
  const resolvedVariant = variant ?? 'default';
  const chrome: DialogChromeContextValue = {
    contentVariant: resolvedVariant,
    showCloseButton,
    closeInHeader,
    closeButtonHoverable,
    noBorder,
    resizable: enableResize,
  };

  // Geometry state is owned by the hook even when `enableResize` is
  // false (cheap; React skips the renders that would be wasted). We
  // gate JSX side-effects (handles + style + drag listener) on the
  // flag so non-resizable dialogs are unaffected.
  const geom = useResizableGeometry({
    storageKey: enableResize ? resizeStorageKey : undefined,
    ...(resizeDefaultWidth !== undefined ? { defaultWidth: resizeDefaultWidth } : {}),
    ...(resizeDefaultHeight !== undefined ? { defaultHeight: resizeDefaultHeight } : {}),
    ...(resizeMinWidth !== undefined ? { minWidth: resizeMinWidth } : {}),
    ...(resizeMinHeight !== undefined ? { minHeight: resizeMinHeight } : {}),
  });

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          dialogContentVariants({ variant, hoverable, noBorder }),
          enableResize && 'max-w-none',
          className,
        )}
        style={enableResize ? { ...geom.containerStyle, ...(props.style ?? {}) } : props.style}
        onMouseDown={enableResize ? geom.handleDragMouseDown : props.onMouseDown}
        {...(({ style: _s, onMouseDown: _o, ...rest }) => rest)(props)}>
        <DialogChromeContext.Provider value={chrome}>
          {children}
          {showCloseButton && !closeInHeader ? (
            <DialogContentFloatClose
              variant={resolvedVariant}
              closeButtonHoverable={closeButtonHoverable}
              noBorder={noBorder}
            />
          ) : null}
          {enableResize ? <DialogResizeAffordances geom={geom} /> : null}
        </DialogChromeContext.Provider>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/**
 * Resize / reset overlay for `enableResize` dialogs. Lives outside the
 * normal flow — 8 hit-targets along the edges + corners + a small reset
 * affordance in the top-right (only after the user has resized once).
 */
function DialogResizeAffordances({
  geom,
}: {
  geom: ReturnType<typeof useResizableGeometry>;
}) {
  return (
    <>
      {/* Edges */}
      <div
        onMouseDown={geom.handleResizeStart('n')}
        className="absolute left-2 right-2 top-0 h-1 cursor-ns-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('s')}
        className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('w')}
        className="absolute bottom-2 left-0 top-2 w-1 cursor-ew-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('e')}
        className="absolute bottom-2 right-0 top-2 w-1 cursor-ew-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      {/* Corners */}
      <div
        onMouseDown={geom.handleResizeStart('nw')}
        className="absolute left-0 top-0 h-2 w-2 cursor-nwse-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('ne')}
        className="absolute right-0 top-0 h-2 w-2 cursor-nesw-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('sw')}
        className="absolute bottom-0 left-0 h-2 w-2 cursor-nesw-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={geom.handleResizeStart('se')}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 text-[8px] leading-none text-[var(--vscode-descriptionForeground)]">
          ◢
        </span>
      </div>
    </>
  );
}

function DialogHeader({
  className,
  showClose: showCloseInHeader = true,
  children,
  style,
  ...rest
}: React.ComponentProps<'div'> & { showClose?: boolean }) {
  const ctx = useDialogChromeOptional();
  const showX = Boolean(
    ctx?.showCloseButton && showCloseInHeader && ctx.closeInHeader,
  );
  // When the surrounding DialogContent is resizable, the header doubles
  // as the drag-move handle. Marker attribute + `cursor: move` are
  // applied here so individual dialogs don't need to opt in by hand.
  const dragProps = ctx?.resizable
    ? {
        'data-dialog-handle': 'drag',
        style: { cursor: 'move', ...style } as React.CSSProperties,
      }
    : { style };
  if (!ctx) {
    return (
      <div
        data-slot="dialog-header"
        className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
        style={style}
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
        ctx.resizable && 'select-none',
        className,
      )}
      {...dragProps}
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
