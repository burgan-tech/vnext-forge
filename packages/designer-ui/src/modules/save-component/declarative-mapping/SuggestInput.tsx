import { useId, useRef, useState } from 'react';

/** Suggestions at the caret and how to apply one of them. */
export interface SuggestState {
  items: string[];
  apply: (item: string) => { text: string; caret: number };
}

export type SuggestFn = (text: string, caret: number) => SuggestState | null;

const INPUT =
  'w-full rounded-md border bg-muted-surface px-2 py-1 font-mono text-[11px] text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all placeholder:text-subtle';

/**
 * Single-line input with a suggestion list (↑/↓ move, Enter or Tab inserts,
 * Esc closes). `onCommit` fires on blur / Enter for inputs that apply their
 * value only when done (a `set` key); otherwise `onChange` fires per keystroke.
 */
export function SuggestInput({
  value,
  onChange,
  onCommit,
  suggest,
  placeholder,
  ariaLabel,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit?: () => void;
  suggest: SuggestFn;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [state, setState] = useState<SuggestState | null>(null);
  const [active, setActive] = useState(0);
  const items = state?.items ?? [];

  const refresh = (text: string, caret: number) => {
    setState(suggest(text, caret));
    setActive(0);
  };

  const insert = (item: string) => {
    const el = ref.current;
    if (!el || !state) return;
    const { text, caret } = state.apply(item);
    onChange(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      refresh(text, caret);
    });
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        aria-autocomplete="list"
        aria-controls={items.length > 0 ? listId : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onFocus={(e) => refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onClick={(e) => refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
          }
        }}
        onBlur={() => {
          setTimeout(() => setState(null), 120);
          onCommit?.();
        }}
        onKeyDown={(e) => {
          if (items.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => (i + 1) % items.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (i - 1 + items.length) % items.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              insert(items[active]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setState(null);
              return;
            }
          }
          if (e.key === 'Enter' && onCommit) {
            e.preventDefault();
            onCommit();
          }
        }}
        className={`${INPUT} ${invalid ? 'border-destructive-border' : 'border-border focus:border-primary-border'}`}
      />
      {items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-surface absolute right-0 left-0 z-20 mt-0.5 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-md">
          {items.map((item, i) => (
            <li
              key={item}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(item);
              }}
              className={`cursor-pointer px-2.5 py-1 font-mono text-[11px] ${i === active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
