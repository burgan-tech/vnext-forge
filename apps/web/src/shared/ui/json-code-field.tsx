import * as React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/cn';

const jsonCodeFieldVariants = cva(
  'overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out',
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
      readOnly: {
        true: '',
        false: 'shadow-md',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        readOnly: false,
        className: 'border-primary-border-hover bg-primary-surface',
      },
      {
        variant: 'secondary',
        readOnly: false,
        className: 'border-secondary-border-hover bg-secondary-surface',
      },
      {
        variant: 'tertiary',
        readOnly: false,
        className: 'border-tertiary-border-hover bg-tertiary-surface',
      },
      {
        variant: 'default',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
      readOnly: false,
    },
  },
);

interface JsonCodeFieldProps
  extends Omit<React.ComponentProps<'div'>, 'onChange'>,
    VariantProps<typeof jsonCodeFieldVariants> {
  height?: number;
  language?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  value: string;
}

function JsonCodeField({
  className,
  height = 160,
  language = 'json',
  onChange,
  hoverable = false,
  noBorder = false,
  readOnly = false,
  variant,
  value,
  ...props
}: JsonCodeFieldProps) {
  return (
    <div
      data-slot="json-code-field"
      className={cn(jsonCodeFieldVariants({ variant, hoverable, noBorder, readOnly }), className)}
      style={{ height }}
      {...props}
    >
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        theme="vs"
        options={{
          folding: false,
          fontSize: 11,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbers: 'off',
          lineNumbersMinChars: 0,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          readOnly,
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          scrollbar: { horizontalScrollbarSize: 6, verticalScrollbarSize: 6 },
          tabSize: 2,
          wordWrap: 'on',
        }}
        className={cn(!readOnly && 'ring-1 ring-current/5')}
      />
    </div>
  );
}

export { JsonCodeField, jsonCodeFieldVariants };
