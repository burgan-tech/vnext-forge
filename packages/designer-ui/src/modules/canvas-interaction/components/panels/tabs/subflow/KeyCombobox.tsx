import { useEffect, useId, useState } from 'react';

interface KeyComboboxProps {
  value: string;
  options: string[];
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

/**
 * Free-text key input with suggestions (native `<datalist>`). Commits on blur
 * or Enter, so renaming a record key does not rewrite the document per
 * keystroke. Values outside `options` stay allowed: the child definition may
 * be missing or older than the parent. Blank input reverts.
 */
export function KeyCombobox({ value, options, onCommit, ariaLabel, placeholder }: KeyComboboxProps) {
  const listId = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onCommit(trimmed);
  };

  return (
    <>
      <input
        type="text"
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(value);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
