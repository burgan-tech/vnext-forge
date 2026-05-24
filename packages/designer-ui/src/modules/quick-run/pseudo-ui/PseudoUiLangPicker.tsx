/**
 * R20-followup: compact inline picker for `pseudoUiLang` (the
 * setting that drives `<PseudoView lang>` multi-lang resolution).
 *
 * Lives next to the rendered pseudo-ui surface so extension users
 * — who don't see the web shell sidebar — can switch the locale
 * the view renders in without leaving the dashboard. Settings are
 * persisted via `useSettingsStore`, so the choice survives page
 * reloads and applies to every other pseudo-ui surface mounted
 * concurrently (the surface subscribes directly to the store).
 */

import { Globe, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '../../../ui/Input';
import { BUILTIN_PSEUDO_UI_LANGS, useSettingsStore } from '../../../store/useSettingsStore';

const BUILTIN_PRESETS: readonly { value: string; label: string }[] = BUILTIN_PSEUDO_UI_LANGS.map(
  (value) => ({ value, label: value.toUpperCase() }),
);

export interface PseudoUiLangPickerProps {
  /** Optional extra Tailwind classes for the outer wrapper. */
  className?: string;
}

export function PseudoUiLangPicker({ className }: PseudoUiLangPickerProps) {
  const lang = useSettingsStore((s) => s.pseudoUiLang);
  const setLang = useSettingsStore((s) => s.setPseudoUiLang);
  const customLangs = useSettingsStore((s) => s.pseudoUiCustomLangs);
  const addCustomLang = useSettingsStore((s) => s.addPseudoUiCustomLang);
  const removeCustomLang = useSettingsStore((s) => s.removePseudoUiCustomLang);
  const [expanded, setExpanded] = useState(false);

  // Decoupled draft so the user can clear the input and retype a new
  // ISO code without the normalizer (which falls back to the default
  // when trimmed is empty) snapping the field back to 'tr' mid-keystroke.
  // We commit (a) into the active language *and* (b) into the persisted
  // custom-lang list, so the new chip stays available even after the
  // user switches back to TR / EN.
  const [draft, setDraft] = useState('');

  // When the active language changes from another mounted picker, sync
  // the draft so the open input mirrors the current value the next time
  // it opens. Only sync when the popover is closed — while the user is
  // typing we don't want external updates clobbering their edit.
  useEffect(() => {
    if (!expanded) setDraft('');
  }, [lang, expanded]);

  const commitDraft = (): void => {
    const trimmed = draft.trim().toLowerCase();
    if (trimmed.length === 0) return;
    addCustomLang(trimmed);
    setLang(trimmed);
    setDraft('');
    setExpanded(false);
  };

  return (
    <div
      className={['flex items-center gap-1', className ?? ''].join(' ')}
      role="group"
      aria-label="Pseudo-UI render language"
    >
      <Globe size={11} aria-hidden className="shrink-0 text-muted-text" />
      {BUILTIN_PRESETS.map((preset) => {
        const active = lang === preset.value;
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => setLang(preset.value)}
            aria-pressed={active}
            title={`Render multi-language text in ${preset.label}`}
            className={chipClasses(active)}
          >
            {preset.label}
          </button>
        );
      })}
      {customLangs.map((code) => {
        const active = lang === code;
        return (
          <span
            key={code}
            className={[
              'flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'border-primary-border-hover bg-primary-muted text-foreground'
                : 'border-primary-border bg-primary text-muted-text hover:bg-primary-hover hover:text-foreground',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={active}
              title={`Render multi-language text in ${code.toUpperCase()}`}
              className="px-0.5 outline-none"
            >
              {code.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => removeCustomLang(code)}
              title={`Remove ${code.toUpperCase()} from the list`}
              aria-label={`Remove ${code.toUpperCase()}`}
              className="rounded p-0.5 text-muted-text hover:bg-destructive-muted hover:text-destructive-icon"
            >
              <X size={9} aria-hidden />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide custom language input' : 'Add a custom ISO code'}
        title="Add a custom ISO code"
        className="rounded border border-primary-border bg-primary px-1.5 py-0.5 text-[9px] text-muted-text hover:bg-primary-hover hover:text-foreground"
      >
        {expanded ? '×' : '+'}
      </button>
      {expanded && (
        <Input
          size="sm"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft('');
              setExpanded(false);
            }
          }}
          placeholder="ISO"
          aria-label="Add a custom ISO language code"
          className="h-6 w-20 text-[10px]"
        />
      )}
    </div>
  );
}

function chipClasses(active: boolean): string {
  return [
    'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors',
    active
      ? 'border-primary-border-hover bg-primary-muted text-foreground'
      : 'border-primary-border bg-primary text-muted-text hover:bg-primary-hover hover:text-foreground',
  ].join(' ');
}
