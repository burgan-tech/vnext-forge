import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle } from 'lucide-react';

import { cn } from '../lib/utils/cn.js';

const inputRootVariants = cva(
  'group/input relative isolate flex w-full items-center overflow-hidden rounded-[3px] border shadow-xs transition-all duration-200 ease-out outline-none',
  {
    variants: {
      variant: {
        default:
          'cursor-text border-primary-border bg-primary text-primary-foreground focus-within:border-primary-border-hover focus-within:bg-primary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        success:
          'cursor-text border-success-border bg-success text-success-foreground focus-within:border-success-border-hover focus-within:bg-success-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        info: 'cursor-text border-info-border bg-info text-info-foreground focus-within:border-info-border-hover focus-within:bg-info-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        warning:
          'cursor-text border-warning-border bg-warning text-warning-foreground focus-within:border-warning-border-hover focus-within:bg-warning-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        destructive:
          'cursor-text border-destructive-border bg-destructive-muted text-destructive-text focus-within:border-destructive-border-hover focus-within:bg-destructive-muted-hover focus-within:ring-[3px] focus-within:ring-destructive/20',
        secondary:
          'cursor-text border-secondary-border bg-secondary text-secondary-foreground focus-within:border-secondary-border-hover focus-within:bg-secondary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        tertiary:
          'cursor-text border-tertiary-border bg-tertiary text-tertiary-foreground focus-within:border-tertiary-border-hover focus-within:bg-tertiary-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        muted:
          'cursor-default border-muted-border bg-muted text-muted-foreground focus-within:border-muted-border-hover focus-within:bg-muted-hover focus-within:ring-[3px] focus-within:ring-ring/40',
      },
      size: {
        sm: 'min-h-8 gap-1.5 px-2',
        default: 'min-h-10 gap-2 px-2',
        lg: 'min-h-11 gap-2.5 px-2.5',
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
        variant: 'success',
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
        invalid: true,
        variant: 'info',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
      {
        invalid: true,
        variant: 'warning',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
      {
        invalid: true,
        variant: 'destructive',
        className: 'focus-within:border-destructive-border-hover focus-within:ring-destructive/12',
      },
      {
        variant: 'default',
        hoverable: true,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
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
        className: 'hover:border-destructive-border-hover hover:bg-destructive-muted-hover',
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
        variant: 'muted',
        hoverable: true,
        className: 'hover:border-muted-border-hover hover:bg-muted-hover',
      },
      {
        invalid: true,
        hoverable: true,
        className:
          'hover:border-destructive-border-hover hover:bg-destructive/10 hover:ring-destructive/15',
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
  'placeholder:text-current/50 selection:bg-primary-muted selection:text-primary-foreground flex-1 border-0 bg-transparent py-0 text-sm text-current outline-none file:mr-3 file:rounded-[2px] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-current file:py-0 read-only:cursor-default disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'min-h-0 text-sm',
        default: 'min-h-0 text-sm',
        lg: 'min-h-0 text-base',
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
  'flex shrink-0 items-center justify-center rounded-[2px] border shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary-muted text-primary-icon',
        success: 'border-success-border bg-success-surface text-success-icon',
        info: 'border-info-border bg-info-surface text-info-icon',
        warning: 'border-warning-border bg-warning-surface text-warning-icon',
        destructive: 'border-destructive-border bg-destructive-muted text-destructive-icon',
        secondary: 'border-secondary-border bg-secondary-muted text-secondary-icon',
        tertiary: 'border-tertiary-border bg-tertiary-muted text-tertiary-icon',
        muted: 'border-muted-border bg-muted-surface text-muted-icon',
      },
      size: {
        sm: 'size-6 text-xs',
        default: 'size-7 text-sm',
        lg: 'size-8 text-sm',
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
        className:
          'group-hover/input:border-primary-border-hover group-hover/input:bg-primary-muted-hover',
      },
      {
        variant: 'success',
        hoverable: true,
        className:
          'group-hover/input:border-success-border-hover group-hover/input:bg-success-hover',
      },
      {
        variant: 'info',
        hoverable: true,
        className: 'group-hover/input:border-info-border-hover group-hover/input:bg-info-hover',
      },
      {
        variant: 'warning',
        hoverable: true,
        className:
          'group-hover/input:border-warning-border-hover group-hover/input:bg-warning-hover',
      },
      {
        variant: 'destructive',
        hoverable: true,
        className:
          'group-hover/input:border-destructive-border-hover group-hover/input:bg-destructive-muted-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        className:
          'group-hover/input:border-secondary-border-hover group-hover/input:bg-secondary-muted-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        className:
          'group-hover/input:border-tertiary-border-hover group-hover/input:bg-tertiary-muted-hover',
      },
      {
        variant: 'muted',
        hoverable: true,
        className: 'group-hover/input:border-muted-border-hover group-hover/input:bg-muted-hover',
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
  extends
    NativeInputProps,
    Omit<VariantProps<typeof inputRootVariants>, 'disabledState' | 'readOnlyState'>,
    Omit<VariantProps<typeof inputAdornmentVariants>, 'size' | 'hoverable'> {
  error?: React.ReactNode;
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
      error,
      hoverable = true,
      inputClassName,
      leading,
      noAdornmentHover = false,
      noBorder = false,
      readOnly = false,
      size,
      trailing,
      variant,
      'aria-describedby': ariaDescribedByFromUser,
      'aria-invalid': ariaInvalidFromUser,
      ...restProps
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const errorId = React.useId();
    const errorDescriptionId = error ? `${errorId}-error` : undefined;

    const ariaInvalidFromProps =
      ariaInvalidFromUser === true ||
      ariaInvalidFromUser === 'true' ||
      ariaInvalidFromUser === 'grammar' ||
      ariaInvalidFromUser === 'spelling';
    const invalid = ariaInvalidFromProps || Boolean(error);

    const ariaDescribedBy =
      [ariaDescribedByFromUser, errorDescriptionId].filter(Boolean).join(' ') || undefined;

    const effectiveHoverable = hoverable && !disabled && !readOnly;

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    return (
      <div data-slot="input-field" className="flex w-full flex-col gap-1">
        <div
          data-slot="input-root"
          className={cn(
            inputRootVariants({
              variant,
              size,
              invalid,
              disabledState: disabled,
              readOnlyState: readOnly,
              hoverable: effectiveHoverable,
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
                  hoverable: effectiveHoverable && !noAdornmentHover,
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
              variant === 'muted' &&
                'text-muted-foreground placeholder:text-muted-foreground/55 read-only:text-muted-foreground',
              inputClassName,
            )}
            {...restProps}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
          />
          {trailing ? (
            <span
              data-slot="input-trailing"
              className={cn(
                inputAdornmentVariants({
                  variant,
                  size,
                  hoverable: effectiveHoverable && !noAdornmentHover,
                }),
                'relative z-10',
              )}>
              {trailing}
            </span>
          ) : null}
        </div>
        {error ? (
          <div
            id={errorDescriptionId}
            data-slot="input-error"
            role="alert"
            className="text-destructive-text ml-1 flex items-start gap-1.5 text-xs leading-snug">
            <AlertCircle
              className="text-destructive-icon mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">{error}</span>
          </div>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, inputElementVariants, inputRootVariants };
