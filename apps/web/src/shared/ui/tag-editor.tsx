import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@shared/lib/utils/cn';

interface TagEditorProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  onChange: (tags: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  tags: string[];
}

function TagEditor({
  className,
  onChange,
  placeholder = 'Add tag...',
  readOnly = false,
  tags,
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
      className={cn(
        'border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 flex-wrap gap-1 rounded-md border px-2 py-1.5 transition-[color,box-shadow] focus-within:ring-[3px]',
        className,
      )}
      {...props}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
        >
          {tag}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:text-destructive transition-colors"
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
          className="placeholder:text-muted-foreground min-w-20 flex-1 bg-transparent text-sm outline-none"
        />
      ) : null}
    </div>
  );
}

export { TagEditor };
