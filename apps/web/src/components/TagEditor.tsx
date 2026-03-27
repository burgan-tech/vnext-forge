import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function TagEditor({ tags, onChange, placeholder = 'Add tag...', readOnly }: TagEditorProps) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap gap-1 p-1.5 border border-border rounded bg-background min-h-[28px]">
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded"
        >
          {tag}
          {!readOnly && (
            <button onClick={() => removeTag(i)} className="hover:text-destructive">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[60px] text-xs bg-transparent outline-none"
        />
      )}
    </div>
  );
}
