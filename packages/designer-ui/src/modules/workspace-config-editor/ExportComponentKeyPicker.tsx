import { Loader2 } from 'lucide-react';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import { ComponentFileIcon } from '../component-icons/ComponentFileIcon.js';
import { cn } from '../../lib/utils/cn.js';
import type { VnextComponentType } from '../../shared/projectTypes.js';

export interface ExportComponentKeyPickerProps {
  /** Satır ikonu — `ChooseExistingVnextComponentDialog` ile aynı rozetler. */
  iconType?: VnextComponentType;
  /** Keşfedilen bileşenler (genelde `key` sıralı). */
  options: DiscoveredVnextComponent[];
  /** Seçili export `key` listesi (form ile senkron). */
  value: string[];
  onChange: (keys: string[]) => void;
  loading?: boolean;
  /** Liste boşken kısa bilgi. */
  emptyHint?: string;
  disabled?: boolean;
  className?: string;
  /** Erişilebilirlik: üstteki kategori başlığı `id` ile eşleşir. */
  ariaLabelledBy?: string;
}

function toggleKey(keys: readonly string[], key: string): string[] {
  const i = keys.indexOf(key);
  if (i === -1) return [...keys, key];
  return keys.filter((k) => k !== key);
}

/**
 * Çoklu seçim: satırlar ince ayırıcılarla birleşik liste; seçili satır success yüzeyi + sol çizgi ile okunur.
 */
export function ExportComponentKeyPicker({
  iconType = 'task',
  options,
  value,
  onChange,
  loading = false,
  emptyHint = 'No components found for current paths.',
  disabled = false,
  className,
  ariaLabelledBy,
}: ExportComponentKeyPickerProps) {
  const selected = new Set(value);
  const isEmpty = !loading && options.length === 0;
  /** Boş değilken üst sınır + kaydırma; boşken yükseklik içeriğe göre (fazla boşluk yok). */
  const capsHeight = loading || options.length > 0;

  return (
    <div className={cn(className)}>
      <div
        className={cn(
          'border-border-subtle bg-surface/30 flex flex-col overflow-hidden rounded-md border p-0.5',
          capsHeight && 'max-h-52 min-h-0',
          disabled && 'pointer-events-none opacity-60',
        )}
        role="listbox"
        aria-labelledby={ariaLabelledBy}
        aria-multiselectable="true"
        aria-busy={loading}>
        <div
          className={cn(
            'motion-safe:scroll-smooth overflow-y-auto',
            capsHeight && 'min-h-0 flex-1',
          )}>
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-8 text-xs">
              <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
              Scanning…
            </div>
          ) : isEmpty ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-xs leading-normal sm:py-7">
              {emptyHint}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {options.map((opt) => {
                const isOn = selected.has(opt.key);
                return (
                  <li
                    key={`${opt.path}:${opt.key}`}
                    className="border-border-subtle/80 bg-background/40 overflow-hidden rounded-md border">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      disabled={disabled}
                      onClick={() => onChange(toggleKey(value, opt.key))}
                      className={cn(
                        'motion-safe:transition-colors flex w-full min-h-0 cursor-pointer items-center gap-1.5 px-2 py-1 text-left duration-200',
                        'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:outline-none',
                        'border-l-[3px] border-l-transparent',
                        isOn
                          ? 'bg-success-surface text-success-text border-l-success-border hover:bg-success-hover/15'
                          : 'hover:border-border hover:bg-muted/60 border border-transparent',
                      )}>
                      <ComponentFileIcon type={iconType} className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono leading-tight',
                            isOn ? 'text-success-text' : 'text-foreground',
                          )}>
                          <span className="text-[11px] font-normal tabular-nums">{opt.key}</span>
                          {opt.version ? (
                            <span
                              className={cn(
                                'rounded px-0.5 py-0 text-[9px] font-normal leading-none tabular-nums',
                                isOn
                                  ? 'bg-success-surface text-success-icon'
                                  : 'text-muted-foreground bg-muted/50',
                              )}>
                              v{opt.version}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
