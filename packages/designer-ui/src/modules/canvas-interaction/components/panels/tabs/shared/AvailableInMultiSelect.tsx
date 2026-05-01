import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../../../../../ui/Popover.js';
import { Checkbox } from '../../../../../../ui/Checkbox.js';

export interface StateOption {
  key: string;
  label?: string;
}

export interface AvailableInMultiSelectProps {
  value: string[];
  onChange: (keys: string[]) => void;
  stateOptions: StateOption[];
  placeholder?: string;
}

export function AvailableInMultiSelect({
  value,
  onChange,
  stateOptions,
  placeholder = 'Select states…',
}: AvailableInMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stateOptions;
    return stateOptions.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        (s.label && s.label.toLowerCase().includes(q)),
    );
  }, [stateOptions, search]);

  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const remove = (key: string) => {
    onChange(value.filter((k) => k !== key));
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-xl border border-border bg-muted-surface px-2.5 py-1.5 text-left text-xs transition-all hover:border-muted-border-hover focus:border-primary-border focus:ring-2 focus:ring-ring/20 focus:outline-none cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={open}>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {value.length > 0 ? `${value.length} state${value.length > 1 ? 's' : ''} selected` : placeholder}
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-h-[280px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
            <Search size={13} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search states…"
              className="min-w-0 flex-1 border-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label="Search states"
            />
          </div>
          <div
            className="max-h-[220px] overflow-y-auto p-1"
            role="listbox"
            aria-multiselectable="true"
            aria-label="Available states">
            {stateOptions.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
                No states in this workflow.
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
                No matching states.
              </div>
            ) : (
              filtered.map((opt) => {
                const checked = value.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(opt.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      variant="secondary"
                      className="pointer-events-none size-3.5"
                      tabIndex={-1}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                      {opt.key}
                    </span>
                    {opt.label && (
                      <span className="shrink-0 truncate text-[10px] text-muted-foreground max-w-[40%]">
                        {opt.label}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {value.map((key) => {
            const opt = stateOptions.find((s) => s.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
                {opt?.label ? `${key}` : key}
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-destructive-text transition-colors"
                  aria-label={`Remove ${key}`}>
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
