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

import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '../../../ui/Input';
import { useSettingsStore } from '../../../store/useSettingsStore';

/**
 * Quick chips for the platform's two primary locales. Any other ISO
 * code is reachable via the `…` popover input. Keep this list short
 * — the row lives in a dense header and clutter pushes the picker
 * off the visible header on narrow widths.
 */
const QUICK_PRESETS: readonly { value: string; label: string }[] = [
  { value: 'tr', label: 'TR' },
  { value: 'en', label: 'EN' },
];

export interface PseudoUiLangPickerProps {
  /** Optional extra Tailwind classes for the outer wrapper. */
  className?: string;
}

export function PseudoUiLangPicker({ className }: PseudoUiLangPickerProps) {
  const lang = useSettingsStore((s) => s.pseudoUiLang);
  const setLang = useSettingsStore((s) => s.setPseudoUiLang);
  const [expanded, setExpanded] = useState(false);

  // Decoupled draft so the user can clear the input and retype a new
  // ISO code without the normalizer (which falls back to the default
  // when the trimmed value is empty) snapping the field back to 'tr'
  // mid-keystroke. We only commit non-empty drafts to the store; an
  // empty draft is allowed locally but treated as a no-op.
  const [draft, setDraft] = useState(lang);

  // Re-sync the local draft when the store value changes from
  // anywhere else (the sidebar picker, a chip click on another
  // mounted picker, persisted hydration, …).
  useEffect(() => {
    setDraft(lang);
  }, [lang]);

  const commitDraft = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      // Restore the displayed value to the active store lang so the
      // field never visually "swallows" the user's edit.
      setDraft(lang);
      return;
    }
    if (trimmed !== lang) setLang(trimmed);
  };

  // When the current value isn't one of the quick presets, surface
  // a small chip so users still see the active locale at a glance.
  const customChipVisible = !QUICK_PRESETS.some((p) => p.value === lang) && lang.length > 0;

  return (
    <div
      className={['flex items-center gap-1', className ?? ''].join(' ')}
      role="group"
      aria-label="Pseudo-UI render language"
    >
      <Globe size={11} aria-hidden className="shrink-0 text-muted-text" />
      {QUICK_PRESETS.map((preset) => {
        const active = lang === preset.value;
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => setLang(preset.value)}
            aria-pressed={active}
            title={`Render multi-language text in ${preset.label}`}
            className={[
              'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'border-primary-border-hover bg-primary-muted text-foreground'
                : 'border-primary-border bg-primary text-muted-text hover:bg-primary-hover hover:text-foreground',
            ].join(' ')}
          >
            {preset.label}
          </button>
        );
      })}
      {customChipVisible && (
        <span
          className="rounded border border-primary-border-hover bg-primary-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground"
          title="Custom ISO code"
        >
          {lang.toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide custom language input' : 'Set a custom ISO code'}
        title="Custom ISO code"
        className="rounded border border-primary-border bg-primary px-1.5 py-0.5 text-[9px] text-muted-text hover:bg-primary-hover hover:text-foreground"
      >
        {expanded ? '×' : '…'}
      </button>
      {expanded && (
        <Input
          size="sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder="ISO"
          aria-label="Custom ISO language code"
          className="h-6 w-20 text-[10px]"
        />
      )}
    </div>
  );
}
