import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Plus, X } from 'lucide-react';

import { Button } from './Button';
import { Input } from './Input';
import { cn } from '../lib/utils/cn.js';

export interface KeyValuePair {
  key: string;
  value: string;
}

export type KVPair = KeyValuePair;

const keyValueEditorRowVariants = cva(
  'flex items-center gap-2 transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        plain: '',
        default:
          'rounded-xl border p-2 border-primary-border-hover bg-primary-surface text-primary-foreground shadow-sm',
        secondary:
          'rounded-xl border p-2 border-secondary-border-hover bg-secondary-surface text-secondary-foreground shadow-sm',
        tertiary:
          'rounded-xl border p-2 border-tertiary-border-hover bg-tertiary-surface text-tertiary-foreground shadow-sm',
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
      variant: 'plain',
      hoverable: false,
      noBorder: false,
    },
  },
);

interface KeyValueEditorProps
  extends
    Omit<React.ComponentProps<'div'>, 'onChange'>,
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
    onChange(
      pairs.map((pair, currentIndex) =>
        currentIndex === index ? { ...pair, [field]: value } : pair,
      ),
    );
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
                variant="destructive"
                size="icon"
                onClick={() => removePair(index)}
                aria-label={`Remove row ${index + 1}`}>
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly ? (
        <Button
          type="button"
          variant="default"
          leftIconVariant="success"
          size="sm"
          onClick={addPair}
          leftIcon={<Plus />}
          className="mt-1">
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

const KVEditor = KeyValueEditor;

export { KeyValueEditor, KVEditor, keyValueEditorRowVariants };
