import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { type VariantProps } from 'class-variance-authority';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';

import { selectVariants } from './Select.js';
import { Input, type InputProps } from './Input.js';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './Popover.js';

/** Default copy for `DropdownSelectComboboxField` when `placeholder` is omitted. */
export const DROPDOWN_COMBOBOX_DEFAULT_PLACEHOLDER =
  'Create a new folder or Select an existing folder';

const DropdownSelect = SelectPrimitive.Root;

const DropdownSelectGroup = SelectPrimitive.Group;

const DropdownSelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn(
      'data-[placeholder]:text-muted-foreground min-w-0 flex-1 truncate text-left',
      className,
    )}
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
      '[&>svg]:text-primary-icon [&>svg]:shrink-0 [&>svg]:transition-transform [&[data-state=open]>svg]:rotate-180',
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
          'border-border bg-background text-foreground relative z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border shadow-md',
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
      'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'data-[highlighted]:bg-primary-muted data-[highlighted]:text-primary-text',
      'focus:bg-primary-muted focus:text-primary-text',
      className,
    )}
    {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="text-primary-icon size-4" />
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
  extends
    Omit<React.ComponentProps<typeof SelectPrimitive.Root>, 'children'>,
    VariantProps<typeof selectVariants> {
  options: DropdownSelectOption[];
  placeholder?: string;
  className?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

const DropdownSelectField = React.forwardRef<HTMLButtonElement, DropdownSelectFieldProps>(
  (
    { options, placeholder, className, variant, hoverable, noBorder, onBlur, ...rootProps },
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

export interface DropdownSelectComboboxFieldProps
  extends Omit<InputProps, 'value' | 'defaultValue' | 'onChange' | 'trailing' | 'leading' | 'error' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Same shape as `DropdownSelectField` options — shown in the suggestion list. */
  options: DropdownSelectOption[];
  /** Extra classes for the popover list (e.g. `z-[200]` in dialogs). */
  contentClassName?: string;
  /**
   * When true, `options` are filtered by the current value (substring, case-insensitive).
   * @default true
   */
  filterOptions?: boolean;
}

/**
 * Combobox: same shell as `Input` (inline), with a trailing chevron that opens a suggestion list.
 * Text field uses `Input` so styling matches other form fields.
 */
const DropdownSelectComboboxField = React.forwardRef<HTMLInputElement, DropdownSelectComboboxFieldProps>(
  function DropdownSelectComboboxField(
    {
      value,
      onValueChange,
      options,
      placeholder = DROPDOWN_COMBOBOX_DEFAULT_PLACEHOLDER,
      disabled,
      id,
      'aria-label': ariaLabel,
      className,
      contentClassName,
      filterOptions = true,
      variant = 'muted',
      size = 'sm',
      hoverable = true,
      noBorder = false,
      inputClassName,
      onKeyDown: onKeyDownFromProps,
      ...inputRest
    },
    ref,
  ) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listScrollRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);
    const [menuWidth, setMenuWidth] = React.useState<number | undefined>(undefined);
    const generatedListId = React.useId();
    const listId = id ? `${id}-listbox` : `combobox-list-${generatedListId}`;

    const filteredOptions = React.useMemo(() => {
      if (!filterOptions || options.length === 0) return options;
      const q = value.trim().toLowerCase();
      if (!q) return options;
      return options.filter(
        (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
      );
    }, [options, value, filterOptions]);

    React.useLayoutEffect(() => {
      if (!open || !rootRef.current) return;
      setMenuWidth(rootRef.current.getBoundingClientRect().width);
    }, [open]);

    const hasSuggestions = options.length > 0;

    /**
     * Portaled list: ref exists after a frame. Wheel on inner `div` with `passive: false` so
     * `preventDefault` + `scrollTop` works in webviews; `stopPropagation` keeps the dialog from scrolling.
     */
    React.useLayoutEffect(() => {
      if (!open || !hasSuggestions) return;
      let remove: (() => void) | undefined;
      let cancelled = false;
      const raf2Id = { current: 0 };
      const raf1 = requestAnimationFrame(() => {
        raf2Id.current = requestAnimationFrame(() => {
          if (cancelled) return;
          const el = listScrollRef.current;
          if (!el) return;
          const onWheel = (e: WheelEvent) => {
            e.stopPropagation();
            e.preventDefault();
            el.scrollTop += e.deltaY;
          };
          el.addEventListener('wheel', onWheel, { passive: false });
          remove = () => el.removeEventListener('wheel', onWheel);
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        if (raf2Id.current) cancelAnimationFrame(raf2Id.current);
        remove?.();
      };
    }, [open, hasSuggestions, filteredOptions.length]);

    const suggestionTrigger = hasSuggestions ? (
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="text-primary-icon hover:text-primary-text flex h-full w-full min-h-0 min-w-0 cursor-pointer items-center justify-center rounded-[2px] border-0 bg-transparent p-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
          data-state={open ? 'open' : 'closed'}
          aria-label="Open suggestions"
          aria-expanded={open}
          aria-haspopup="listbox"
          data-slot="combobox-chevron">
          <ChevronDownIcon
            aria-hidden
            className={cn('size-4 shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
          />
        </button>
      </PopoverTrigger>
    ) : undefined;

    const keepOpenIfComboboxField = (e: { preventDefault: () => void; target: EventTarget | null }) => {
      const target = e.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        e.preventDefault();
      }
    };

    const listPanel = hasSuggestions && (
      <PopoverContent
        id={listId}
        role="listbox"
        align="start"
        side="bottom"
        sideOffset={2}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={keepOpenIfComboboxField}
        onInteractOutside={keepOpenIfComboboxField}
        onFocusOutside={keepOpenIfComboboxField}
        onWheel={(e) => e.stopPropagation()}
        className={cn(
          'border-border bg-background text-foreground z-[200] !min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border p-0 shadow-md',
          'data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0 data-[side=bottom]:pt-0',
          contentClassName,
        )}
        style={
          menuWidth != null
            ? { width: menuWidth, minWidth: menuWidth, maxWidth: menuWidth }
            : undefined
        }>
        <div
          ref={listScrollRef}
          tabIndex={-1}
          className="max-h-48 min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain p-0 [scrollbar-width:thin]">
          {filteredOptions.length === 0 ? (
            <div className="text-muted-foreground px-2.5 py-2.5 text-left text-xs">No matches</div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                title={opt.label}
                disabled={opt.disabled}
                className={cn(
                  'text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  'relative flex w-full min-w-0 cursor-pointer items-center rounded-none px-2.5 py-2 text-left text-sm outline-none select-none',
                  'transition-colors duration-150',
                  'hover:bg-primary-muted/90 focus:bg-primary-muted/90',
                  'active:bg-primary-muted',
                  value === opt.value && 'bg-primary-muted/80 font-medium',
                )}
                onClick={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}>
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    );

    const fieldProps: InputProps = {
      ...inputRest,
      ref,
      id,
      type: 'text',
      role: 'combobox',
      'aria-label': ariaLabel,
      'aria-expanded': hasSuggestions ? open : undefined,
      'aria-autocomplete': hasSuggestions ? 'list' : undefined,
      'aria-controls': hasSuggestions ? listId : undefined,
      value,
      onChange: (e) => onValueChange(e.target.value),
      onKeyDown: (e) => {
        if (e.key === 'Escape') setOpen(false);
        onKeyDownFromProps?.(e);
      },
      disabled,
      placeholder,
      variant,
      size,
      hoverable,
      noBorder,
      className: cn('min-w-0', open && hasSuggestions && 'rounded-b-none', className),
      inputClassName: cn('text-foreground', inputClassName),
      trailing: suggestionTrigger,
    };

    return (
      <div className="w-full min-w-0" data-state={open && hasSuggestions ? 'open' : 'closed'}>
        {hasSuggestions ? (
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverAnchor asChild>
              <div ref={rootRef} className="w-full min-w-0">
                <Input {...fieldProps} />
              </div>
            </PopoverAnchor>
            {listPanel}
          </Popover>
        ) : (
          <div ref={rootRef} className="w-full min-w-0">
            <Input {...fieldProps} />
          </div>
        )}
      </div>
    );
  },
);
DropdownSelectComboboxField.displayName = 'DropdownSelectComboboxField';

export {
  DropdownSelect,
  DropdownSelectComboboxField,
  DropdownSelectContent,
  DropdownSelectField,
  DropdownSelectGroup,
  DropdownSelectItem,
  DropdownSelectLabel,
  DropdownSelectSeparator,
  DropdownSelectTrigger,
  DropdownSelectValue,
};
