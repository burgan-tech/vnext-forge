import * as React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronRight } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';

const contextMenuContentVariants = cva(
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md transition-all duration-150 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
);

const contextMenuItemVariants = cva(
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none transition-all duration-150 ease-out data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'text-primary-text focus:bg-primary-muted focus:text-primary-text data-[highlighted]:bg-primary-muted data-[state=open]:bg-primary-muted [&_svg:not([class*=text-])]:text-primary-icon',
        secondary:
          'text-secondary-text focus:bg-secondary-muted focus:text-secondary-text data-[highlighted]:bg-secondary-muted data-[state=open]:bg-secondary-muted [&_svg:not([class*=text-])]:text-secondary-icon',
        tertiary:
          'text-tertiary-text focus:bg-tertiary-muted focus:text-tertiary-text data-[highlighted]:bg-tertiary-muted data-[state=open]:bg-tertiary-muted [&_svg:not([class*=text-])]:text-tertiary-icon',
        destructive:
          'text-destructive-text focus:bg-destructive/10 focus:text-destructive-text data-[highlighted]:bg-destructive/10 data-[state=open]:bg-destructive/10 [&_svg:not([class*=text-])]:text-destructive-icon',
      },
      hoverable: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      hoverable: true,
    },
  },
);

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuGroup({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

function ContextMenuContent({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content> &
  VariantProps<typeof contextMenuContentVariants>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(contextMenuContentVariants({ variant }), className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = 'secondary',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: VariantProps<typeof contextMenuItemVariants>['variant'];
  hoverable?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      className={cn(contextMenuItemVariants({ variant, hoverable }), className)}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  variant = 'secondary',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator> & {
  variant?: Exclude<VariantProps<typeof contextMenuItemVariants>['variant'], 'destructive'>;
}) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn(
        '-mx-1 my-1 h-px',
        variant === 'default' && 'bg-primary-border',
        variant === 'secondary' && 'bg-secondary-border',
        variant === 'tertiary' && 'bg-tertiary-border',
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSub({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  variant = 'secondary',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  variant?: Exclude<VariantProps<typeof contextMenuItemVariants>['variant'], 'destructive'>;
  hoverable?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(contextMenuItemVariants({ variant, hoverable }), className)}
      {...props}>
      {children}
      <ChevronRight className="ml-auto size-4" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent> &
  VariantProps<typeof contextMenuContentVariants>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        contextMenuContentVariants({ variant }),
        'min-w-[8rem] overflow-hidden p-1 shadow-lg',
        className,
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
};
