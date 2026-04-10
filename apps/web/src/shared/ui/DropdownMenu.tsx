import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';

import { cn } from '@shared/lib/utils/Cn';

const dropdownMenuContentVariants = cva(
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md transition-all duration-200 ease-out',
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
        className: 'hover:border-primary-border-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'hover:border-secondary-border-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'hover:border-tertiary-border-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

const dropdownMenuItemVariants = cva(
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none transition-all duration-200 ease-out data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'text-primary-text [&_svg:not([class*=text-])]:text-primary-icon',
        secondary: 'text-secondary-text [&_svg:not([class*=text-])]:text-secondary-icon',
        tertiary: 'text-tertiary-text [&_svg:not([class*=text-])]:text-tertiary-icon',
        destructive: 'text-destructive-text [&_svg:not([class*=text-])]:text-destructive-icon',
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
        className: 'focus:bg-primary-muted focus:text-primary-text data-[state=open]:bg-primary-muted',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'focus:bg-secondary-muted focus:text-secondary-text data-[state=open]:bg-secondary-muted',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'focus:bg-tertiary-muted focus:text-tertiary-text data-[state=open]:bg-tertiary-muted',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className: 'focus:bg-destructive/10 focus:text-destructive-text data-[state=open]:bg-destructive/10',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: true,
    },
  },
);

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  variant,
  hoverable = false,
  noBorder,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> &
  VariantProps<typeof dropdownMenuContentVariants>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(dropdownMenuContentVariants({ variant, hoverable, noBorder }), className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
  hoverable?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(dropdownMenuItemVariants({ variant, hoverable }), className)}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  variant = 'default',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
  hoverable?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(dropdownMenuItemVariants({ variant, hoverable }), 'pl-8', className)}
      checked={checked}
      {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  variant = 'default',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
  hoverable?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(dropdownMenuItemVariants({ variant, hoverable }), 'pl-8', className)}
      {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2 py-1.5 text-sm font-medium data-[inset]:pl-8',
        variant === 'secondary' && 'text-secondary-text',
        variant === 'tertiary' && 'text-tertiary-text',
        variant === 'default' && 'text-primary-text',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & {
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
}) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
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

function DropdownMenuShortcut({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & {
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
}) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'ml-auto text-xs tracking-widest opacity-70',
        variant === 'default' && 'text-primary-icon',
        variant === 'secondary' && 'text-secondary-icon',
        variant === 'tertiary' && 'text-tertiary-icon',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  variant = 'default',
  hoverable = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  variant?: Exclude<VariantProps<typeof dropdownMenuItemVariants>['variant'], 'destructive'>;
  hoverable?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(dropdownMenuItemVariants({ variant, hoverable }), className)}
      {...props}>
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  variant,
  hoverable = false,
  noBorder,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> &
  VariantProps<typeof dropdownMenuContentVariants>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        dropdownMenuContentVariants({ variant, hoverable, noBorder }),
        'min-w-[8rem] overflow-hidden shadow-lg',
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  dropdownMenuContentVariants,
};
