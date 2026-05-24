/**
 * Multi-language text editor.
 *
 * Accepts either a plain string or `{ en, tr, ... }` object form, per
 * the pseudo-ui SDK's `textContent` $def in `view-vocabulary.json`.
 * Switches modes inline; in object mode each language is its own
 * compact card (ISO 639-1 code + value).
 *
 * Extracted from `PropertyInspector.tsx` (R12) so other inspectors
 * (e.g. `StepsField` for Stepper steps) can share the same UX
 * without copy-paste.
 */
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Input } from '../../../../../ui/Input';
import { Textarea } from '../../../../../ui/Textarea';

export interface MultiLangInputProps {
  value: unknown;
  onChange: (next: unknown) => void;
  multiline?: boolean;
  placeholder?: string;
}

export function MultiLangInput({
  value,
  onChange,
  multiline,
  placeholder,
}: MultiLangInputProps) {
  const isString = typeof value === 'string';
  const obj = typeof value === 'object' && value !== null ? (value as Record<string, string>) : {};
  const [mode, setMode] = useState<'object' | 'string'>(isString ? 'string' : 'object');

  if (mode === 'string') {
    return (
      <div className="flex flex-col gap-1">
        {multiline ? (
          <Textarea
            className="text-xs"
            value={isString ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <Input
            size="sm"
            value={isString ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button
          type="button"
          className="self-start text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => {
            setMode('object');
            onChange({ en: isString ? value : '' });
          }}
        >
          Switch to multi-language
        </button>
      </div>
    );
  }

  const existingKeys = Object.keys(obj);
  const langs = existingKeys.length > 0 ? existingKeys : ['en'];

  /** Validate against the SDK vocabulary regex: ISO 639-1 + optional region. */
  const isValidLangCode = (code: string): boolean => /^[a-z]{2}(-[A-Z]{2})?$/.test(code);

  const renameKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    if (newKey === '' || Object.prototype.hasOwnProperty.call(obj, newKey)) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const removeKey = (key: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== key) next[k] = v;
    }
    onChange(next);
  };

  const addKey = () => {
    const used = new Set(existingKeys);
    const candidates = ['tr', 'en', 'ar', 'de', 'fr', 'es'];
    const next = candidates.find((c) => !used.has(c)) ?? '';
    if (next === '') return;
    onChange({ ...obj, [next]: '' });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {langs.map((lang) => {
        const valid = lang === '' || isValidLangCode(lang);
        return (
          <div
            key={lang}
            className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] p-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <Input
                value={lang}
                onChange={(e) =>
                  renameKey(
                    lang,
                    e.target.value.trim().toLowerCase().replace(/[^a-z-]/g, ''),
                  )
                }
                aria-label="Language code"
                spellCheck={false}
                className={[
                  'h-6 w-[64px] px-1.5 text-[10px] uppercase tracking-wide',
                  !valid ? 'border-[var(--vscode-inputValidation-warningBorder)]' : '',
                ].join(' ')}
                title={!valid ? 'Expected ISO 639-1 code, e.g. en, tr, en-US' : undefined}
              />
              <button
                type="button"
                aria-label={`Remove ${lang} translation`}
                className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => removeKey(lang)}
                disabled={langs.length <= 1}
              >
                <Trash2 size={11} />
              </button>
            </div>
            {multiline ? (
              <Textarea
                className="text-xs"
                value={obj[lang] ?? ''}
                onChange={(e) => onChange({ ...obj, [lang]: e.target.value })}
                placeholder={placeholder}
                rows={2}
              />
            ) : (
              <Input
                size="sm"
                value={obj[lang] ?? ''}
                onChange={(e) => onChange({ ...obj, [lang]: e.target.value })}
                placeholder={placeholder}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={addKey}
        >
          <Plus size={10} /> Add language
        </button>
        <button
          type="button"
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => {
            setMode('string');
            onChange(obj.en ?? '');
          }}
        >
          Switch to plain text
        </button>
      </div>
    </div>
  );
}
