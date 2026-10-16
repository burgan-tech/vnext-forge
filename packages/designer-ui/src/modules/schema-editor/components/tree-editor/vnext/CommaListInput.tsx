import { useEffect, useState } from 'react';

import { Input } from '../../../../../ui/Input';

/** Comma-separated text → list (blank items dropped). */
export function parseCommaList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

interface CommaListInputProps {
  value: readonly unknown[];
  onCommit: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Edits a string list as comma-separated text. Keeps a local draft while
 * typing (so a trailing comma survives) and commits on blur or Enter.
 */
export function CommaListInput({ value, onCommit, placeholder }: CommaListInputProps) {
  const text = value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ');
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  const commit = () => {
    const next = parseCommaList(draft);
    if (next.join('\u0000') !== value.map(String).join('\u0000')) onCommit(next);
    else setDraft(text);
  };

  return (
    <Input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      placeholder={placeholder}
      inputClassName="font-mono text-xs"
    />
  );
}
