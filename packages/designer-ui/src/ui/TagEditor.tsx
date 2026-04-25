import * as React from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';
import { Badge } from './Badge';

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
  /** Boş “yeni etiket” alanında gösterilir; mevcut etiketler varken de görünür (giriş dolunca gizlenir). */
  placeholder?: string;
  readOnly?: boolean;
  tags: string[];
}

function TagEditor({
  className,
  hoverable,
  noBorder,
  onChange,
  placeholder = 'Add tag',
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
          className="tag-editor-chip max-w-full gap-1 pr-0.5 text-xs [&>span]:min-w-0">
          <span className="leading-none">{tag}</span>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className={cn(
                'tag-editor-chip-remove inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center',
                'rounded-sm p-0 leading-none shadow-none outline-none',
                'focus-visible:ring-ring/50 focus-visible:ring-2',
              )}
              aria-label={`Remove ${tag}`}>
              <X className="block size-2.5 shrink-0" aria-hidden />
            </button>
          ) : null}
        </Badge>
      ))}
      {!readOnly ? (
        <input
          data-slot="tag-editor-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            'ml-1 min-w-28 flex-1 border-0 bg-transparent py-0.5 text-sm text-current ring-0 outline-none',
            'placeholder:text-current/50',
            'selection:bg-primary-muted selection:text-primary-foreground',
          )}
        />
      ) : null}
    </div>
  );
}

export { TagEditor, tagEditorVariants };
