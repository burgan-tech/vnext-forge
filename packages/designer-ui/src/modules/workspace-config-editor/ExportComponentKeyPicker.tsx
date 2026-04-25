import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils/cn.js';
import { Button } from '../../ui/Button.js';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';

export interface ExportComponentKeyPickerProps {
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
          'border-border/60 bg-muted/20 flex flex-col overflow-hidden rounded-lg border',
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
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-8 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
              Scanning…
            </div>
          ) : isEmpty ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm leading-normal sm:py-7">
              {emptyHint}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {options.map((opt) => {
                const isOn = selected.has(opt.key);
                return (
                  <li key={`${opt.path}:${opt.key}`}>
                    <Button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      variant="ghost"
                      size="sm"
                      hoverable
                      noBorder
                      disabled={disabled}
                      onClick={() => onChange(toggleKey(value, opt.key))}
                      className={cn(
                        'motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out',
                        'h-auto min-h-0 w-full shrink justify-start rounded-none px-0 py-0 shadow-none',
                        'border-l-[3px] border-l-transparent font-normal',
                        '[&>span]:flex [&>span]:w-full [&>span]:min-w-0 [&>span]:items-center [&>span]:justify-between [&>span]:gap-2',
                        'focus-visible:ring-offset-background',
                        isOn
                          ? 'bg-success-surface text-success-text border-l-success-border hover:!bg-success-hover/15'
                          : 'text-foreground hover:!bg-muted/40',
                      )}>
                      <span className="min-w-0 flex-1 truncate text-left font-mono text-sm font-medium leading-snug tracking-tight">
                        {opt.key}
                      </span>
                      {opt.version ? (
                        <span
                          className={cn(
                            'shrink-0 tabular-nums text-xs font-normal leading-none',
                            isOn ? 'text-success-icon' : 'text-muted-foreground',
                          )}>
                          v{opt.version}
                        </span>
                      ) : null}
                    </Button>
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
