import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const inputRootVariants = cva(
  'group/input relative isolate flex w-full items-center overflow-hidden rounded-2xl border shadow-xs transition-all duration-200 ease-out outline-none',
  {
    variants: {
      variant: {
        default:
          'cursor-text border-primary-border bg-primary text-primary-foreground focus-within:border-primary-border-hover focus-within:bg-primary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        secondary:
          'cursor-text border-secondary-border bg-secondary text-secondary-foreground focus-within:border-secondary-border-hover focus-within:bg-secondary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        tertiary:
          'cursor-text border-tertiary-border bg-tertiary text-tertiary-foreground focus-within:border-tertiary-border-hover focus-within:bg-tertiary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
      },
      size: {
        sm: 'min-h-9 gap-2 px-3',
        default: 'min-h-11 gap-2.5 px-3.5',
        lg: 'min-h-12 gap-3 px-4',
      },
      invalid: {
        true: 'border-destructive-border bg-destructive/5 ring-[3px] ring-destructive/10',
        false: '',
      },
      disabledState: {
        true: 'cursor-not-allowed opacity-60',
        false: '',
      },
      readOnlyState: {
        true: 'cursor-default',
        false: '',
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
        invalid: true,
        variant: 'default',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
      {
        invalid: true,
        variant: 'secondary',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
      {
        invalid: true,
        variant: 'tertiary',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
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
        disabledState: true,
        className: 'hover:translate-y-0',
      },
      {
        readOnlyState: true,
        className: 'hover:translate-y-0',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      invalid: false,
      disabledState: false,
      readOnlyState: false,
      hoverable: true,
      noBorder: false,
    },
  },
);

const inputElementVariants = cva(
  'placeholder:text-current/50 selection:bg-primary-muted selection:text-primary-foreground flex-1 border-0 bg-transparent text-sm text-current outline-none file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-current disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'py-2 text-sm',
        default: 'py-2.5 text-sm',
        lg: 'py-3 text-base',
      },
      hasLeading: {
        true: '',
        false: '',
      },
      hasTrailing: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      size: 'default',
      hasLeading: false,
      hasTrailing: false,
    },
  },
);

const inputAdornmentVariants = cva(
  'flex shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary-muted text-primary-icon',
        secondary: 'border-secondary-border bg-secondary-muted text-secondary-icon',
        tertiary: 'border-tertiary-border bg-tertiary-muted text-tertiary-icon',
      },
      size: {
        sm: 'size-7 text-xs',
        default: 'size-8 text-sm',
        lg: 'size-9 text-sm',
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
        className: 'group-hover/input:border-primary-border-hover group-hover/input:bg-primary-muted-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className: 'group-hover/input:border-secondary-border-hover group-hover/input:bg-secondary-muted-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className: 'group-hover/input:border-tertiary-border-hover group-hover/input:bg-tertiary-muted-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      hoverable: true,
    },
  },
);

type NativeInputProps = Omit<React.ComponentProps<'input'>, 'size'>;

interface InputProps
  extends NativeInputProps,
    Omit<VariantProps<typeof inputRootVariants>, 'disabledState' | 'readOnlyState'>,
    Omit<VariantProps<typeof inputAdornmentVariants>, 'size' | 'hoverable'> {
  hoverable?: boolean;
  inputClassName?: string;
  leading?: React.ReactNode;
  noAdornmentHover?: boolean;
  trailing?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      disabled = false,
      hoverable = true,
      inputClassName,
      leading,
      noAdornmentHover = false,
      noBorder = false,
      readOnly = false,
      size,
      trailing,
      variant,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    return (
      <div
        data-slot="input-root"
        className={cn(
          inputRootVariants({
            variant,
            size,
            invalid,
            disabledState: disabled,
            readOnlyState: readOnly,
            hoverable,
            noBorder,
          }),
          className,
        )}
        onMouseDown={(event) => {
          if (disabled || readOnly) {
            return;
          }

          const target = event.target as HTMLElement;
          if (target.closest('input, button, a, [role="button"], [role="link"]')) {
            return;
          }

          event.preventDefault();
          inputRef.current?.focus();
        }}>
        {leading ? (
          <span
            data-slot="input-leading"
            className={cn(
              inputAdornmentVariants({
                variant,
                size,
                hoverable: hoverable && !noAdornmentHover && !disabled && !readOnly,
              }),
              'relative z-10',
            )}>
            {leading}
          </span>
        ) : null}
        <input
          ref={inputRef}
          data-slot="input"
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            inputElementVariants({
              size,
              hasLeading: Boolean(leading),
              hasTrailing: Boolean(trailing),
            }),
            'relative z-10',
            inputClassName,
          )}
          {...props}
        />
        {trailing ? (
          <span
            data-slot="input-trailing"
            className={cn(
              inputAdornmentVariants({
                variant,
                size,
                hoverable: hoverable && !noAdornmentHover && !disabled && !readOnly,
              }),
              'relative z-10',
            )}>
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, inputElementVariants, inputRootVariants };
