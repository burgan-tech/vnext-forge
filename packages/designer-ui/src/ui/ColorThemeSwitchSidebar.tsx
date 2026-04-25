import * as React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, SunMoon } from 'lucide-react';

import { useResolvedColorTheme } from '../hooks/useResolvedColorTheme.js';
import type { ColorThemePreference } from '../store/useSettingsStore.js';
import { cn } from '../lib/utils/cn.js';

export interface ColorThemeSwitchSidebarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: ColorThemePreference;
  onChange: (next: ColorThemePreference) => void;
  /** Satır etiketleri — i18n için */
  labels?: Partial<Record<ColorThemePreference, string>>;
  /** Accordion / dar panel: daha sıkı satır ve ikon boyutu */
  compact?: boolean;
  /**
   * `card` — kendi border/gradient kabuğu (tek başına kullanım).
   * `plain` — dış kutu yok; accordion vb. içerikte gömülü kullanım.
   */
  variant?: 'card' | 'plain';
}

const DEFAULT_LABELS: Record<ColorThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const OPTIONS: {
  id: ColorThemePreference;
  Icon: typeof Sun;
}[] = [
  { id: 'light', Icon: Sun },
  { id: 'dark', Icon: Moon },
  { id: 'system', Icon: SunMoon },
];

const spring = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.55 };

/**
 * Dar yan panel (ör. ayarlar sütunu) için dikey tema seçici.
 * Tam `ColorThemeSwitch` yerine: üç mod (light / dark / system), liste düzeni, aynı token ve hafif motion dili.
 */
function ColorThemeSwitchSidebar({
  value,
  onChange,
  className,
  labels: labelsProp,
  compact = false,
  variant = 'card',
  ...rest
}: ColorThemeSwitchSidebarProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const resolved = useResolvedColorTheme();
  const groupId = React.useId();
  const isPlain = variant === 'plain';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = OPTIONS.findIndex((o) => o.id === value);
    const nextIdx =
      e.key === 'ArrowDown'
        ? Math.min(idx + 1, OPTIONS.length - 1)
        : Math.max(idx - 1, 0);
    onChange(OPTIONS[nextIdx]!.id);
  };

  return (
    <div className={cn('w-full', className)} {...rest}>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-legend`}
        className={cn(
          'flex flex-col',
          isPlain
            ? 'gap-1'
            : cn('gap-0.5 border border-border p-1', compact ? 'rounded-lg' : 'gap-1 rounded-xl'),
        )}
        style={
          isPlain
            ? undefined
            : {
                borderColor: 'color-mix(in srgb, var(--color-border) 92%, var(--color-foreground))',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--color-muted) 35%, transparent) 0%, var(--color-background) 100%)',
              }
        }
        onKeyDown={handleKeyDown}>
        <span id={`${groupId}-legend`} className="sr-only">
          Color theme
        </span>
        {OPTIONS.map(({ id, Icon }) => {
          const selected = value === id;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-state={selected ? 'on' : 'off'}
              data-slot="color-theme-switch-sidebar-item"
              className={cn(
                'relative flex w-full items-center rounded-lg text-left font-medium outline-none transition-colors',
                compact
                  ? 'gap-2 px-2 py-1.5 text-[11px] leading-tight'
                  : 'gap-2.5 px-2.5 py-2 text-xs',
                'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.985 }}>
              {selected && (
                <motion.span
                  layoutId="color-theme-sidebar-highlight"
                  className={cn(
                    'absolute inset-0 rounded-lg',
                    isPlain ? 'bg-muted' : 'border border-border bg-muted shadow-sm',
                  )}
                  style={
                    isPlain
                      ? undefined
                      : {
                          boxShadow:
                            'inset 0 1px 0 color-mix(in srgb, white 40%, transparent), 0 1px 2px color-mix(in srgb, var(--color-foreground) 6%, transparent)',
                        }
                  }
                  transition={spring}
                />
              )}
              <span
                className={cn(
                  'relative z-[1] flex shrink-0 items-center justify-center rounded-full border transition-colors',
                  compact ? 'size-7' : 'size-8',
                  selected
                    ? 'border-border bg-background text-[var(--color-brand-from)]'
                    : 'border-transparent bg-chrome-item text-muted-foreground',
                )}
                style={{
                  boxShadow: selected
                    ? 'inset 1px 1px 4px color-mix(in srgb, var(--color-foreground) 6%, transparent)'
                    : 'inset 2px 2px 6px color-mix(in srgb, black 35%, transparent)',
                }}>
                <Icon className={compact ? 'size-3.5' : 'size-4'} strokeWidth={2} aria-hidden />
              </span>
              <span className="relative z-[1] min-w-0 flex-1">{labels[id]}</span>
            </motion.button>
          );
        })}
      </div>
      {value === 'system' && (
        <p
          className={cn(
            'text-muted-foreground px-0.5 leading-snug',
            compact ? 'mt-1.5 text-[9px]' : 'mt-2 text-[10px]',
          )}>
          Follows your OS ({resolved === 'dark' ? 'dark' : 'light'} now).
        </p>
      )}
    </div>
  );
}

export { ColorThemeSwitchSidebar };
