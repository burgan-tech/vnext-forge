import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { type VariantProps } from 'class-variance-authority';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';

import { selectVariants } from './Select.js';

const DropdownSelect = SelectPrimitive.Root;

const DropdownSelectGroup = SelectPrimitive.Group;

const DropdownSelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('flex-1 min-w-0 truncate text-left data-[placeholder]:text-muted-foreground', className)}
    {...props}
  />
));
DropdownSelectValue.displayName = 'DropdownSelectValue';

type DropdownSelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> &
  VariantProps<typeof selectVariants>;

const DropdownSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  DropdownSelectTriggerProps
>(({ className, children, variant, hoverable, noBorder, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      selectVariants({ variant, hoverable, noBorder }),
      'flex w-full min-w-0 items-center justify-between gap-2 text-left',
      'data-[state=open]:rounded-b-none',
      'data-[state=open]:border-primary-border-hover data-[state=open]:ring-0',
      '[&>svg]:shrink-0 [&>svg]:text-primary-icon [&>svg]:transition-transform [&[data-state=open]>svg]:rotate-180',
      className,
    )}
    {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon aria-hidden className="size-4 opacity-70" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
DropdownSelectTrigger.displayName = 'DropdownSelectTrigger';

function DropdownSelectContent({
  className,
  children,
  position = 'popper',
  side = 'bottom',
  align = 'start',
  sideOffset = 0,
  avoidCollisions = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        side={side}
        align={align}
        sideOffset={sideOffset}
        avoidCollisions={avoidCollisions}
        className={cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'relative z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-background text-foreground shadow-md',
          'origin-[var(--radix-select-content-transform-origin)] transition-[transform,opacity] duration-150 ease-out',
          'data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0',
          'data-[side=top]:rounded-b-none data-[side=top]:border-b-0',
          className,
        )}
        {...props}>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

const DropdownSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('text-muted-foreground px-2 py-1.5 text-xs font-medium', className)}
    {...props}
  />
));
DropdownSelectLabel.displayName = 'DropdownSelectLabel';

const DropdownSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'data-[highlighted]:bg-primary-muted data-[highlighted]:text-primary-text',
      'focus:bg-primary-muted focus:text-primary-text',
      className,
    )}
    {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-primary-icon" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
DropdownSelectItem.displayName = 'DropdownSelectItem';

const DropdownSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('bg-border -mx-1 my-1 h-px', className)}
    {...props}
  />
));
DropdownSelectSeparator.displayName = 'DropdownSelectSeparator';

export interface DropdownSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownSelectFieldProps
  extends Omit<React.ComponentProps<typeof SelectPrimitive.Root>, 'children'>,
    VariantProps<typeof selectVariants> {
  options: DropdownSelectOption[];
  placeholder?: string;
  className?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

const DropdownSelectField = React.forwardRef<HTMLButtonElement, DropdownSelectFieldProps>(
  (
    {
      options,
      placeholder,
      className,
      variant,
      hoverable,
      noBorder,
      onBlur,
      ...rootProps
    },
    ref,
  ) => (
    <DropdownSelect {...rootProps}>
      <DropdownSelectTrigger
        ref={ref}
        onBlur={onBlur}
        className={className}
        variant={variant}
        hoverable={hoverable}
        noBorder={noBorder}>
        <DropdownSelectValue placeholder={placeholder} />
      </DropdownSelectTrigger>
      <DropdownSelectContent>
        {options.map((opt) => (
          <DropdownSelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </DropdownSelectItem>
        ))}
      </DropdownSelectContent>
    </DropdownSelect>
  ),
);
DropdownSelectField.displayName = 'DropdownSelectField';

export {
  DropdownSelect,
  DropdownSelectContent,
  DropdownSelectField,
  DropdownSelectGroup,
  DropdownSelectItem,
  DropdownSelectLabel,
  DropdownSelectSeparator,
  DropdownSelectTrigger,
  DropdownSelectValue,
};
