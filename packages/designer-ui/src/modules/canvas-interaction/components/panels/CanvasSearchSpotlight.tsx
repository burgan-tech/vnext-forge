import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search, SearchX, ArrowRight,
  Play, Square, CheckCircle2, XCircle, StopCircle,
  PauseCircle, Circle, Repeat2, LayoutGrid,
  Loader2, UserCircle, Ban, TimerOff,
} from 'lucide-react';
import type { SearchItem } from '../../utils/canvas-search-index';

interface CanvasSearchSpotlightProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectState: (nodeId: string) => void;
  onSelectTransition: (edgeId: string, sourceKey: string, targetKey: string) => void;
  searchItems: SearchItem[];
}

function getStateIcon(stateType?: number, subType?: number): { icon: ReactNode; colorClass: string; bgClass: string } {
  switch (stateType) {
    case 1:
      return { icon: <Play size={14} />, colorClass: 'text-initial', bgClass: 'bg-initial/10' };
    case 3:
      switch (subType) {
        case 1: return { icon: <CheckCircle2 size={14} />, colorClass: 'text-final-success', bgClass: 'bg-final-success/10' };
        case 2: return { icon: <XCircle size={14} />, colorClass: 'text-final-error', bgClass: 'bg-final-error/10' };
        case 3: return { icon: <StopCircle size={14} />, colorClass: 'text-final-terminated', bgClass: 'bg-final-terminated/10' };
        case 4: return { icon: <PauseCircle size={14} />, colorClass: 'text-final-suspended', bgClass: 'bg-final-suspended/10' };
        case 5: return { icon: <Loader2 size={14} />, colorClass: 'text-sky-600', bgClass: 'bg-sky-500/10' };
        case 6: return { icon: <UserCircle size={14} />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-500/10' };
        case 7: return { icon: <Ban size={14} />, colorClass: 'text-rose-600', bgClass: 'bg-rose-500/10' };
        case 8: return { icon: <TimerOff size={14} />, colorClass: 'text-amber-600', bgClass: 'bg-amber-500/10' };
        default: return { icon: <Circle size={14} />, colorClass: 'text-final-terminated', bgClass: 'bg-final-terminated/10' };
      }
    case 4:
      return { icon: <Repeat2 size={14} />, colorClass: 'text-subflow', bgClass: 'bg-subflow/10' };
    case 5:
      return { icon: <LayoutGrid size={14} />, colorClass: 'text-wizard', bgClass: 'bg-wizard/10' };
    default:
      return { icon: <Square size={14} />, colorClass: 'text-intermediate', bgClass: 'bg-intermediate/10' };
  }
}

export function CanvasSearchSpotlight({
  open,
  onOpenChange,
  onSelectState,
  onSelectTransition,
  searchItems,
}: CanvasSearchSpotlightProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  const handleSelect = useCallback(
    (item: SearchItem) => {
      if (item.kind === 'state') {
        onSelectState(item.id);
      } else {
        onSelectTransition(item.id, item.sourceStateKey || '', item.targetStateKey || '');
      }
      onOpenChange(false);
    },
    [onSelectState, onSelectTransition, onOpenChange],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const { states, transitions } = useMemo(() => {
    if (!open) return { states: [], transitions: [] };
    return {
      states: searchItems.filter((item) => item.kind === 'state'),
      transitions: searchItems.filter((item) => item.kind === 'transition'),
    };
  }, [open, searchItems]);

  const totalCount = states.length + transitions.length;

  useEffect(() => {
    if (!open || !liveRegionRef.current) return;
    const timer = setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = query
          ? `${totalCount} result${totalCount !== 1 ? 's' : ''}`
          : '';
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [open, query, totalCount]);

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 animate-fade-in" />
        <DialogPrimitive.Content
          aria-label="Search workflow canvas"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-[20%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 animate-slide-down"
        >
          <Command
            className="rounded-xl border border-border bg-surface/90 shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] backdrop-blur-xl overflow-hidden"
            shouldFilter={true}
            loop
          >
            <div className="flex items-center gap-2.5 border-b border-border px-3.5">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder="Search states and transitions"
                className="flex-1 bg-transparent py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Esc
              </kbd>
            </div>

            <Command.List className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-1.5">
              <Command.Empty className="flex flex-col items-center gap-2 py-8 text-center">
                <SearchX size={32} className="text-muted-foreground/50" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">No matches</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Try another name, key, or spelling.</p>
                </div>
              </Command.Empty>

              {states.length > 0 && (
                <Command.Group heading="States">
                  {states.map((item) => {
                    const { icon, colorClass, bgClass } = getStateIcon(item.stateType, item.subType);
                    return (
                      <Command.Item
                        key={item.id}
                        value={`${item.key} ${item.label}`}
                        onSelect={() => handleSelect(item)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-100 data-[selected=true]:bg-muted-surface"
                      >
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>
                          <span className={colorClass}>{icon}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{item.label}</p>
                          {item.key !== item.label && (
                            <p className="truncate text-[11px] font-mono text-muted-foreground">{item.key}</p>
                          )}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {transitions.length > 0 && (
                <Command.Group heading="Transitions">
                  {transitions.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.key} ${item.label} ${item.sourceStateKey} ${item.targetStateKey}`}
                      onSelect={() => handleSelect(item)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-100 data-[selected=true]:bg-muted-surface"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-[11px] font-mono text-muted-foreground">
                          {item.sourceStateKey} → {item.targetStateKey || '?'}
                        </p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>

          <div
            ref={liveRegionRef}
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
