import { useId, useRef, useState, type ReactNode } from 'react';

import { FieldFoot, FieldLabel } from '../../../../../agent-editor/components/agentFormPrimitives';
import { filterTemplatePaths, insertTemplatePath, openPlaceholderAt } from './agentTemplatePaths';

const INPUT =
  'w-full rounded-lg border border-border bg-muted-surface px-2.5 py-1.5 text-xs text-foreground focus:border-primary-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all';

/**
 * Textarea for an agent template: typing `{{` opens path suggestions (the
 * flow's master schema `data.*` paths plus `body.`, `instance.id`,
 * `instance.key`, `state`). ↑/↓ move, Enter or Tab inserts `path }}`, Esc closes.
 */
export function TemplateTextArea({
  label,
  hint,
  value,
  onChange,
  paths,
  rows = 3,
  placeholder,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  paths: readonly string[];
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [open, setOpen] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const text = value ?? '';
  const items = open ? filterTemplatePaths(paths, open.query) : [];

  const refresh = (nextText: string, caret: number) => {
    const token = openPlaceholderAt(nextText, caret);
    setOpen(token);
    setActive(0);
  };

  const insert = (path: string) => {
    const el = ref.current;
    if (!el || !open) return;
    const { text: next, caret } = insertTemplatePath(text, open.start, el.selectionStart, path);
    onChange(next === '' ? undefined : next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      refresh(el.value, caret);
    });
  };

  return (
    <div className="relative">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        ref={ref}
        value={text}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        aria-label={typeof label === 'string' ? label : undefined}
        aria-autocomplete="list"
        aria-controls={open && items.length > 0 ? listId : undefined}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === '' ? undefined : next);
          refresh(next, e.target.selectionStart);
        }}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            refresh(e.currentTarget.value, e.currentTarget.selectionStart);
          }
        }}
        onClick={(e) => refresh(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setOpen(null), 120)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + items.length) % items.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insert(items[active]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(null);
          }
        }}
        className={`${INPUT} resize-y font-mono`}
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-surface absolute right-0 left-0 z-20 mt-0.5 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-md">
          {items.map((path, i) => (
            <li
              key={path}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(path);
              }}
              className={`cursor-pointer px-2.5 py-1 font-mono text-[11px] ${i === active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
              {path}
            </li>
          ))}
        </ul>
      )}
      <FieldFoot hint={hint} />
    </div>
  );
}
