import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const fieldVariants = cva('space-y-1', {
  variants: {
    variant: {
      default: '',
      secondary: '',
      tertiary: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const fieldLabelVariants = cva(
  'block text-xs font-semibold transition-colors duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'text-primary-text/75',
        secondary: 'text-secondary-text/75',
        tertiary: 'text-tertiary-text/75',
      },
      interactive: {
        true: 'inline-flex w-fit items-center rounded-md px-1.5 py-1 shadow-sm',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        interactive: true,
        className: 'border border-primary-border/60 bg-primary-muted/80 text-primary-text',
      },
      {
        variant: 'secondary',
        interactive: true,
        className: 'border border-secondary-border/60 bg-secondary-muted/80 text-secondary-text',
      },
      {
        variant: 'tertiary',
        interactive: true,
        className: 'border border-tertiary-border/60 bg-tertiary-muted/80 text-tertiary-text',
      },
    ],
    defaultVariants: {
      variant: 'default',
      interactive: false,
    },
  },
);

const fieldHintVariants = cva('text-[10px]', {
  variants: {
    variant: {
      default: 'text-primary-text/65',
      secondary: 'text-secondary-text/65',
      tertiary: 'text-tertiary-text/65',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const fieldErrorVariants = cva('text-[10px] text-destructive-text', {
  variants: {
    variant: {
      default: '',
      secondary: '',
      tertiary: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Field({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return <div data-slot="field" className={cn(fieldVariants({ variant }), className)} {...props} />;
}

function FieldLabel({
  className,
  interactive,
  variant,
  ...props
}: React.ComponentProps<'label'> & VariantProps<typeof fieldLabelVariants>) {
  return (
    <label
      data-slot="field-label"
      className={cn(fieldLabelVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

function FieldHint({
  className,
  variant,
  ...props
}: React.ComponentProps<'p'> & VariantProps<typeof fieldHintVariants>) {
  return (
    <p
      data-slot="field-hint"
      className={cn(fieldHintVariants({ variant }), className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  variant,
  ...props
}: React.ComponentProps<'p'> & VariantProps<typeof fieldErrorVariants>) {
  return (
    <p
      data-slot="field-error"
      className={cn(fieldErrorVariants({ variant }), className)}
      {...props}
    />
  );
}

interface FieldRootProps extends React.ComponentProps<'div'>, VariantProps<typeof fieldVariants> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  errorMsg?: React.ReactNode;
  labelProps?: React.ComponentProps<typeof FieldLabel>;
  hintProps?: React.ComponentProps<typeof FieldHint>;
  errorProps?: React.ComponentProps<typeof FieldError>;
}

interface LegacyFieldProps extends React.ComponentProps<'div'>, VariantProps<typeof fieldVariants> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  errorMsg?: React.ReactNode;
}

type FieldCompatProps =
  | (React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>)
  | LegacyFieldProps;

function hasLegacyFieldProps(
  props: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>,
): props is LegacyFieldProps {
  return 'label' in props || 'hint' in props || 'errorMsg' in props;
}

function FieldRoot({
  className,
  children,
  errorMsg,
  errorProps,
  hint,
  hintProps,
  label,
  labelProps,
  variant,
  ...props
}: FieldRootProps) {
  return (
    <Field className={className} variant={variant} {...props}>
      <FieldLabel variant={variant} {...labelProps}>
        {label}
      </FieldLabel>
      {children}
      {hint ? (
        <FieldHint variant={variant} {...hintProps}>
          {hint}
        </FieldHint>
      ) : null}
      {errorMsg ? (
        <FieldError variant={variant} {...errorProps}>
          {errorMsg}
        </FieldError>
      ) : null}
    </Field>
  );
}

function FieldCompat(props: FieldCompatProps) {
  if (hasLegacyFieldProps(props)) {
    const { errorMsg, hint, label, ...restProps } = props;

    if (label !== undefined) {
      return <FieldRoot label={label} hint={hint} errorMsg={errorMsg} {...restProps} />;
    }
  }

  return <Field {...props} />;
}

export { FieldCompat as Field, FieldError, FieldHint, FieldLabel, FieldRoot, fieldVariants };
