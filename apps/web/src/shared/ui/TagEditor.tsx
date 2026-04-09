import * as React from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@shared/lib/utils/Cn';

const tagEditorVariants = cva(
  'flex min-h-9 flex-wrap gap-1 rounded-md border px-2 py-1.5 shadow-xs transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground focus-within:border-primary-border-hover focus-within:ring-ring/50 focus-within:ring-[3px]',
        secondary:
          'border-secondary-border bg-secondary text-secondary-foreground focus-within:border-secondary-border-hover focus-within:ring-ring/50 focus-within:ring-[3px]',
        tertiary:
          'border-tertiary-border bg-tertiary text-tertiary-foreground focus-within:border-tertiary-border-hover focus-within:ring-ring/50 focus-within:ring-[3px]',
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
      variant: 'default',
      hoverable: true,
      noBorder: false,
    },
  },
);

const tagChipVariants = cva('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-primary-border bg-primary-muted text-primary-icon',
      secondary: 'border-secondary-border bg-secondary-muted text-secondary-icon',
      tertiary: 'border-tertiary-border bg-tertiary-muted text-tertiary-icon',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const tagRemoveButtonVariants = cva(
  'inline-flex size-5 items-center justify-center rounded-sm border shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-icon',
        secondary: 'border-secondary-border bg-secondary text-secondary-icon',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-icon',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        className: 'hover:border-primary-border-hover hover:bg-primary-hover hover:text-destructive',
      },
      {
        variant: 'secondary',
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover hover:text-destructive',
      },
      {
        variant: 'tertiary',
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover hover:text-destructive',
      },
    ],
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface TagEditorProps
  extends Omit<React.ComponentProps<'div'>, 'onChange'>,
    VariantProps<typeof tagEditorVariants> {
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
  const resolvedVariant = variant ?? 'default';

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
      {...props}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className={tagChipVariants({ variant: resolvedVariant })}
        >
          {tag}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className={tagRemoveButtonVariants({ variant: resolvedVariant })}
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      {!readOnly ? (
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="placeholder:text-current/50 min-w-20 flex-1 bg-transparent text-sm outline-none"
        />
      ) : null}
    </div>
  );
}

export { TagEditor, tagEditorVariants };
