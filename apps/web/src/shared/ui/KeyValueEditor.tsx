import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Plus, X } from 'lucide-react';

import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { cn } from '@shared/lib/utils/Cn';

export interface KeyValuePair {
  key: string;
  value: string;
}

const keyValueEditorRowVariants = cva(
  'flex items-center gap-2 rounded-xl border p-2 transition-all duration-200 ease-out',
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
        className: 'border-primary-border-hover bg-primary-surface shadow-sm',
      },
      {
        variant: 'secondary',
        className: 'border-secondary-border-hover bg-secondary-surface shadow-sm',
      },
      {
        variant: 'tertiary',
        className: 'border-tertiary-border-hover bg-tertiary-surface shadow-sm',
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
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
    },
  },
);

interface KeyValueEditorProps
  extends Omit<React.ComponentProps<'div'>, 'onChange'>,
    VariantProps<typeof keyValueEditorRowVariants> {
  addLabel?: string;
  keyPlaceholder?: string;
  onChange: (pairs: KeyValuePair[]) => void;
  pairs: KeyValuePair[];
  readOnly?: boolean;
  valuePlaceholder?: string;
}

function KeyValueEditor({
  addLabel = 'Add',
  className,
  hoverable = false,
  keyPlaceholder = 'Key',
  noBorder = false,
  onChange,
  pairs,
  readOnly = false,
  variant,
  valuePlaceholder = 'Value',
  ...props
}: KeyValueEditorProps) {
  function updatePair(index: number, field: keyof KeyValuePair, value: string) {
    onChange(pairs.map((pair, currentIndex) => (currentIndex === index ? { ...pair, [field]: value } : pair)));
  }

  function addPair() {
    onChange([...pairs, { key: '', value: '' }]);
  }

  function removePair(index: number) {
    onChange(pairs.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div data-slot="key-value-editor" className={cn('space-y-2', className)} {...props}>
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div
            key={index}
            className={cn(keyValueEditorRowVariants({ variant, hoverable, noBorder }))}>
            <Input
              value={pair.key}
              onChange={(event) => updatePair(index, 'key', event.target.value)}
              placeholder={keyPlaceholder}
              readOnly={readOnly}
            />
            <Input
              value={pair.value}
              onChange={(event) => updatePair(index, 'value', event.target.value)}
              placeholder={valuePlaceholder}
              readOnly={readOnly}
            />
            {!readOnly ? (
              <Button
                type="button"
                variant={variant ?? 'default'}
                size="icon"
                onClick={() => removePair(index)}
                noBorder
                noIconHover
                aria-label={`Remove row ${index + 1}`}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly ? (
        <Button
          type="button"
          variant={variant ?? 'default'}
          size="sm"
          onClick={addPair}
          noBorder
          noIconHover
          className="mt-2 shadow-sm"
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

export { KeyValueEditor, keyValueEditorRowVariants };
