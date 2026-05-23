/**
 * Bind expression input with optional schema-aware autocompletion.
 *
 * - When no `paths` are provided (no dataSchema bound), behaves as a plain
 *   text input with a placeholder.
 * - When `paths` are provided, shows a filtered dropdown of matches under
 *   the input as the user types.
 *
 * Bind values can be raw property names (`firstName`), nested paths
 * (`address.city`), or expressions (`$ui.dialogOpen`, `$instance.x`). The
 * autocomplete only suggests schema paths; expressions are entered free-text.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Input } from '../../../../../ui/Input';

export interface BindAutocompleteProps {
  value: string;
  onChange: (next: string) => void;
  /** Schema-derived suggestions. Empty array disables autocomplete. */
  paths: string[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function BindAutocomplete({
  value,
  onChange,
  paths,
  placeholder = 'e.g. firstName',
  ariaLabel,
  disabled,
}: BindAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (paths.length === 0) return [];
    const q = value.trim().toLowerCase();
    if (q === '' || q.startsWith('$')) return paths.slice(0, 12);
    return paths.filter((p) => p.toLowerCase().includes(q)).slice(0, 12);
  }, [paths, value]);

  const showList = open && focused && suggestions.length > 0 && paths.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        placeholder={paths.length > 0 ? placeholder : `${placeholder} (no dataSchema bound)`}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showList}
        disabled={disabled}
        spellCheck={false}
      />
      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-y-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-dropdown-background,var(--vscode-editor-background))] text-[12px] shadow"
        >
          {suggestions.map((path) => (
            <li
              key={path}
              role="option"
              aria-selected={value === path}
              className="cursor-pointer px-2 py-1 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(path);
                setOpen(false);
              }}
            >
              {path}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
