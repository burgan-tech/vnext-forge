import * as React from 'react';

import { cn } from '@shared/lib/utils/cn';

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('space-y-1', className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="field-label"
      className={cn('text-muted-foreground block text-[10px] font-medium', className)}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-hint"
      className={cn('text-muted-foreground text-[10px]', className)}
      {...props}
    />
  );
}

interface FieldRootProps extends React.ComponentProps<'div'> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  labelProps?: React.ComponentProps<'label'>;
  hintProps?: React.ComponentProps<'p'>;
}

function FieldRoot({
  className,
  children,
  hint,
  hintProps,
  label,
  labelProps,
  ...props
}: FieldRootProps) {
  return (
    <Field className={className} {...props}>
      <FieldLabel {...labelProps}>{label}</FieldLabel>
      {children}
      {hint ? <FieldHint {...hintProps}>{hint}</FieldHint> : null}
    </Field>
  );
}

export { Field, FieldHint, FieldLabel, FieldRoot };
