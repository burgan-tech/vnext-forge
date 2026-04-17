import * as React from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';

const tagEditorVariants = cva(
  'flex min-h-9 flex-wrap gap-1 rounded-md border px-2 py-1.5 shadow-xs transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default:
          'border-primary-border bg-primary text-primary-foreground focus-within:border-primary-border-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        success:
          'border-success-border bg-success text-success-foreground focus-within:border-success-border-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        secondary:
          'border-secondary-border bg-secondary text-secondary-foreground focus-within:border-secondary-border-hover focus-within:ring-[3px] focus-within:ring-ring/50',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-foreground focus-within:border-tertiary-border-hover focus-within:ring-[3px] focus-within:ring-ring/50',
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
        variant: 'success',
        hoverable: true,
        className: 'hover:border-success-border-hover hover:bg-success-hover',
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
      hoverable: true,
      noBorder: false,
    },
  },
);

interface TagEditorProps
  extends Omit<React.ComponentProps<'div'>, 'onChange'>, VariantProps<typeof tagEditorVariants> {
  onChange: (tags: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  tags: string[];
}

function TagEditor({
  className,
  hoverable,
  noBorder,
  onChange,
  placeholder = 'Add tag...',
  readOnly = false,
  tags,
  variant,
  ...props
}: TagEditorProps) {
  const [input, setInput] = React.useState('');

  function addTag(value: string) {
    const nextValue = value.trim();
    if (!nextValue || tags.includes(nextValue)) {
      return;
    }

    onChange([...tags, nextValue]);
    setInput('');
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(input);
    }

    if (event.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div
      data-slot="tag-editor"
      className={cn(tagEditorVariants({ variant, hoverable, noBorder }), className)}
      {...props}>
      {tags.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant={variant === 'success' ? 'success' : 'default'}
          className="tag-editor-chip gap-1 pr-0.5 text-xs">
          {tag}
          {!readOnly ? (
            <Button
              type="button"
              onClick={() => removeTag(index)}
              variant="ghost"
              size="icon"
              className="tag-editor-chip-remove hover:bg-destructive/12 hover:text-destructive size-5 min-h-5 border-0 text-current shadow-none"
              aria-label={`Remove ${tag}`}>
              <X className="size-3" />
            </Button>
          ) : null}
        </Badge>
      ))}
      {!readOnly ? (
        <Input
          value={input}
          type="text"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? placeholder : ''}
          variant={variant === 'success' ? 'success' : 'default'}
          size="sm"
          noBorder
          className="min-w-24 flex-1 bg-transparent shadow-none"
          inputClassName="min-w-20 py-1 text-sm"
        />
      ) : null}
    </div>
  );
}

export { TagEditor, tagEditorVariants };
