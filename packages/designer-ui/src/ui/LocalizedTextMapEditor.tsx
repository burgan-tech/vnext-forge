import { useCallback, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from './Button.js';
import { Field } from './Field.js';
import { Input } from './Input.js';

export type LocalizedTextMap = Record<string, string>;

interface LocalizedTextMapEditorProps {
  addLabel?: string;
  className?: string;
  commonLanguages?: string[];
  emptyHint?: string;
  label: string;
  onChange: (value: LocalizedTextMap) => void;
  value: LocalizedTextMap;
}

const DEFAULT_COMMON_LANGUAGES = ['en', 'tr'];
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export function LocalizedTextMapEditor({
  addLabel = 'Add language',
  className,
  commonLanguages = DEFAULT_COMMON_LANGUAGES,
  emptyHint = 'Add a language-specific value.',
  label,
  onChange,
  value,
}: LocalizedTextMapEditorProps) {
  const [nextLanguage, setNextLanguage] = useState('');
  /**
   * Seed languages (`commonLanguages`) are rendered as input rows even
   * when absent from `value`, as a convenience for the most common cases
   * (en + tr). Dismissing a seed via the X button removes the row for
   * the lifetime of this editor instance — without this set the seed
   * would re-appear instantly after delete, making the X button look
   * broken for default rows.
   */
  const [dismissedSeeds, setDismissedSeeds] = useState<Set<string>>(() => new Set());

  const languageCodes = useMemo(() => {
    const visibleSeeds = commonLanguages.filter((code) => !dismissedSeeds.has(code));
    const allCodes = [...visibleSeeds, ...Object.keys(value)];
    return Array.from(new Set(allCodes)).filter((code) => code.trim());
  }, [commonLanguages, value, dismissedSeeds]);

  const normalizedNextLanguage = nextLanguage.trim();
  const canAddLanguage =
    LANGUAGE_CODE_PATTERN.test(normalizedNextLanguage) &&
    !languageCodes.includes(normalizedNextLanguage);

  function setText(language: string, text: string) {
    // Always set — including empty string — so the row stays visible while
    // the user edits. Removal only via the X button (`removeLanguage`).
    onChange({ ...value, [language]: text });
  }

  function addLanguage() {
    if (!canAddLanguage) {
      return;
    }

    // If the user is re-adding a previously dismissed seed, un-dismiss it
    // so the row reappears under the seed list as well as the value map.
    if (dismissedSeeds.has(normalizedNextLanguage)) {
      setDismissedSeeds((prev) => {
        const next = new Set(prev);
        next.delete(normalizedNextLanguage);
        return next;
      });
    }

    onChange({ ...value, [normalizedNextLanguage]: '' });
    setNextLanguage('');
  }

  const removeLanguage = useCallback(
    (language: string) => {
      const next = { ...value };
      delete next[language];

      if (commonLanguages.includes(language)) {
        setDismissedSeeds((prev) => {
          if (prev.has(language)) {
            return prev;
          }
          const out = new Set(prev);
          out.add(language);
          return out;
        });
      }

      onChange(next);
    },
    [commonLanguages, onChange, value],
  );

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-primary-text/75 text-xs font-semibold">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            size="sm"
            value={nextLanguage}
            onChange={(event) => setNextLanguage(event.target.value)}
            placeholder="fr"
            inputClassName="h-7 w-16 font-mono text-[11px]"
            aria-label={`${label} language code`}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            disabled={!canAddLanguage}
            onClick={addLanguage}>
            <Plus size={11} />
            {addLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {languageCodes.map((language) => (
          <Field key={language} label={language}>
            <div className="flex gap-1">
              <Input
                size="sm"
                value={value[language] ?? ''}
                onChange={(event) => setText(language, event.target.value)}
                placeholder={language === 'en' ? 'English text' : ''}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                title={`Remove ${language}`}
                aria-label={`Remove ${language}`}
                onClick={() => removeLanguage(language)}>
                <X size={12} />
              </Button>
            </div>
          </Field>
        ))}
      </div>

      {languageCodes.length === 0 ? (
        <p className="text-muted-foreground text-[10px]">{emptyHint}</p>
      ) : null}
    </div>
  );
}
