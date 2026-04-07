import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const inputRootVariants = cva(
  'group/input relative isolate flex w-full items-center overflow-hidden rounded-2xl border-2 shadow-xs transition-[border-color,background-color,box-shadow,transform] outline-none',
  {
    variants: {
      variant: {
        default:
          'border-primary/35 bg-surface/95 cursor-text hover:-translate-y-px hover:border-primary/55 hover:bg-surface hover:shadow-sm focus-within:border-primary focus-within:bg-surface focus-within:shadow-md focus-within:ring-4 focus-within:ring-ring/12',
        subtle:
          'border-primary/25 bg-muted/80 cursor-text hover:-translate-y-px hover:border-primary/45 hover:bg-surface-raised hover:shadow-sm focus-within:border-primary/75 focus-within:bg-surface focus-within:shadow-md focus-within:ring-4 focus-within:ring-ring/12',
      },
      size: {
        sm: 'min-h-9 gap-2 px-3',
        default: 'min-h-11 gap-2.5 px-3.5',
        lg: 'min-h-12 gap-3 px-4',
      },
      invalid: {
        true: 'border-destructive/60 ring-4 ring-destructive/10',
        false: '',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-60',
        false: '',
      },
      readOnly: {
        true: 'cursor-default bg-muted/60 hover:translate-y-0 hover:shadow-xs',
        false: '',
      },
    },
    compoundVariants: [
      {
        invalid: true,
        variant: 'default',
        className: 'focus-within:border-destructive/70 focus-within:ring-destructive/12',
      },
      {
        invalid: true,
        variant: 'subtle',
        className:
          'border-destructive/50 bg-destructive/5 focus-within:border-destructive/70 focus-within:ring-destructive/12',
      },
      {
        disabled: true,
        className: 'hover:translate-y-0 hover:shadow-xs',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      invalid: false,
      disabled: false,
      readOnly: false,
    },
  },
);

const inputElementVariants = cva(
  'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex-1 border-0 bg-transparent text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed',
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
  'text-muted-foreground flex shrink-0 items-center justify-center transition-colors group-hover/input:text-foreground/80 ',
  {
    variants: {
      size: {
        sm: 'text-xs',
        default: 'text-sm',
        lg: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

type NativeInputProps = Omit<React.ComponentProps<'input'>, 'size'>;

interface InputProps extends NativeInputProps, VariantProps<typeof inputRootVariants> {
  inputClassName?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      disabled = false,
      inputClassName,
      leading,
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
        className={cn(inputRootVariants({ variant, size, invalid, disabled, readOnly }), className)}
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
            className={cn(inputAdornmentVariants({ size }), 'relative z-10')}>
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
            className={cn(inputAdornmentVariants({ size }), 'relative z-10')}>
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, inputElementVariants, inputRootVariants };
