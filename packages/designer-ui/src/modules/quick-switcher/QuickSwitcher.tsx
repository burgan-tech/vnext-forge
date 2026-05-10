import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '../../lib/utils/cn.js';

import { buildQuickSwitcherIndex } from './QuickSwitcherApi.js';
import { fuzzyMatch, highlightMatches, type FuzzyMatch } from './fuzzyMatch.js';
import { useQuickSwitcherStore } from './QuickSwitcherStore.js';
import type { QuickSwitchEntry, QuickSwitchEntryType } from './QuickSwitcherTypes.js';

const TYPE_LABEL: Record<QuickSwitchEntryType, string> = {
  workflow: 'WF',
  state: 'ST',
  transition: 'TX',
  task: 'TASK',
  schema: 'SCHEMA',
  view: 'VIEW',
  function: 'FN',
  extension: 'EXT',
};

const TYPE_COLOR: Record<QuickSwitchEntryType, string> = {
  workflow: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
  state: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  transition: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  task: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  schema: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  view: 'bg-pink-500/15 text-pink-300 ring-pink-500/30',
  function: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  extension: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
};

const RESULT_LIMIT = 80;

export interface QuickSwitcherProps {
  /**
   * Called when the user picks an entry (mouse click or Enter). The host
   * shell wires routing here. Implementations should call `close()` themselves
   * if they want to dismiss; this component does not auto-close so the host
   * can navigate first and close after.
   */
  onSelect: (entry: QuickSwitchEntry) => void;
}

interface RankedEntry {
  entry: QuickSwitchEntry;
  match: FuzzyMatch;
}

/**
 * Cmd+P style quick switcher. Mounts itself when `useQuickSwitcherStore.isOpen`
 * goes true. The first open per project triggers an index build via
 * `buildQuickSwitcherIndex`; subsequent opens reuse the cached entries.
 *
 * The host shell registers a global Cmd+P / Ctrl+P shortcut elsewhere
 * (`useGlobalQuickSwitcherShortcut`) that calls `useQuickSwitcherStore.open(projectId)`.
 */
export function QuickSwitcher({ onSelect }: QuickSwitcherProps) {
  const isOpen = useQuickSwitcherStore((s) => s.isOpen);
  const projectId = useQuickSwitcherStore((s) => s.projectId);
  const cachedProjectId = useQuickSwitcherStore((s) => s.projectId);
  const entries = useQuickSwitcherStore((s) => s.entries);
  const status = useQuickSwitcherStore((s) => s.status);
  const errorMessage = useQuickSwitcherStore((s) => s.errorMessage);
  const query = useQuickSwitcherStore((s) => s.query);
  const selectedIndex = useQuickSwitcherStore((s) => s.selectedIndex);
  const close = useQuickSwitcherStore((s) => s.close);
  const setIndex = useQuickSwitcherStore((s) => s.setIndex);
  const setLoading = useQuickSwitcherStore((s) => s.setLoading);
  const setError = useQuickSwitcherStore((s) => s.setError);
  const setQuery = useQuickSwitcherStore((s) => s.setQuery);
  const moveSelection = useQuickSwitcherStore((s) => s.moveSelection);
  const setSelection = useQuickSwitcherStore((s) => s.setSelection);

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Tracks the projectId of the in-flight fetch (or null when idle).
  // We deliberately avoid a `cancelled` cleanup flag here: setting state
  // (e.g. `setLoading()`) at the top of the effect would change `status` and
  // re-fire the effect, the cleanup would set `cancelled = true`, and the
  // first fetch's resolve would silently skip its `setIndex` call — leaving
  // the palette stuck on "Building index..." forever. The ref instead lets
  // the resolve handler check whether the active project still matches and
  // apply the result regardless of how many times the effect re-fires.
  const inflightProjectIdRef = useRef<string | null>(null);

  // Build (or rebuild) the index when the palette opens for a new project.
  // Guards:
  //   - same project already fetching → ignore
  //   - already cached for this project (ready or error) → skip until refresh
  // Refresh requires switching projects or closing+reopening the palette.
  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (inflightProjectIdRef.current === projectId) return;
    if (cachedProjectId === projectId && status !== 'idle') return;

    inflightProjectIdRef.current = projectId;
    setLoading();
    buildQuickSwitcherIndex(projectId)
      .then((result) => {
        if (inflightProjectIdRef.current !== projectId) return;
        inflightProjectIdRef.current = null;
        setIndex(projectId, result.entries, result.warnings);
      })
      .catch((err) => {
        if (inflightProjectIdRef.current !== projectId) return;
        inflightProjectIdRef.current = null;
        const message =
          err instanceof Error && err.message ? err.message : 'Index build failed';
        setError(message);
      });
  }, [
    isOpen,
    projectId,
    status,
    cachedProjectId,
    setLoading,
    setIndex,
    setError,
  ]);

  // Focus the input on open.
  useEffect(() => {
    if (isOpen) {
      // small defer so the dialog mounts first
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return;
  }, [isOpen]);

  const ranked: RankedEntry[] = useMemo(() => {
    if (entries.length === 0) return [];
    const trimmed = query.trim();

    if (!trimmed) {
      // No query: show top RESULT_LIMIT in natural order so the user can
      // arrow-navigate immediately after opening.
      return entries.slice(0, RESULT_LIMIT).map((entry) => ({
        entry,
        match: { score: 0, indices: [] },
      }));
    }

    const scored: RankedEntry[] = [];
    for (const entry of entries) {
      // Score against label first, then against the description if no match.
      const labelMatch = fuzzyMatch(trimmed, entry.label);
      if (labelMatch) {
        scored.push({ entry, match: labelMatch });
        continue;
      }
      if (entry.description) {
        const descMatch = fuzzyMatch(trimmed, entry.description);
        if (descMatch) {
          // De-prioritise description-only matches by halving the score.
          scored.push({
            entry,
            match: { score: Math.floor(descMatch.score / 2), indices: [] },
          });
        }
      }
    }
    scored.sort((a, b) => b.match.score - a.match.score);
    return scored.slice(0, RESULT_LIMIT);
  }, [entries, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1, ranked.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1, ranked.length);
      } else if (e.key === 'Enter') {
        const picked = ranked[selectedIndex];
        if (picked) {
          e.preventDefault();
          onSelect(picked.entry);
          close();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [moveSelection, ranked, selectedIndex, onSelect, close],
  );

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        />
        <DialogPrimitive.Content
          aria-label="Quick switcher"
          onOpenAutoFocus={(e) => {
            // we manage focus ourselves so the input receives it (not the
            // first focusable element which Radix picks by default)
            e.preventDefault();
          }}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[15%] left-1/2 z-50 w-[min(90vw,640px)] -translate-x-1/2 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
          <DialogPrimitive.Title className="sr-only">Quick switcher</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and jump to any workflow, state, transition, task, schema, view, function, or extension in the current project.
          </DialogPrimitive.Description>

          <div className="border-b border-white/10 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search workflows, states, transitions, tasks, schemas..."
              className="w-full bg-transparent px-1 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {status === 'loading' ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">Building index...</div>
            ) : status === 'error' ? (
              <div className="px-3 py-8 text-center text-xs text-rose-400">{errorMessage ?? 'Index build failed'}</div>
            ) : ranked.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">
                {query ? 'No matching entries' : 'Project index is empty'}
              </div>
            ) : (
              <ul className="py-1">
                {ranked.map((r, i) => (
                  <QuickSwitcherRow
                    key={r.entry.id}
                    entry={r.entry}
                    indices={r.match.indices}
                    selected={i === selectedIndex}
                    onMouseEnter={() => setSelection(i)}
                    onClick={() => {
                      onSelect(r.entry);
                      close();
                    }}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[10px] text-zinc-500">
            <span>
              {ranked.length} result{ranked.length === 1 ? '' : 's'}
              {entries.length > ranked.length && ` of ${entries.length}`}
            </span>
            <span>↑↓ navigate · ⏎ open · esc close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface QuickSwitcherRowProps {
  entry: QuickSwitchEntry;
  indices: number[];
  selected: boolean;
  onMouseEnter(): void;
  onClick(): void;
}

function QuickSwitcherRow({ entry, indices, selected, onMouseEnter, onClick }: QuickSwitcherRowProps) {
  const segments = highlightMatches(entry.label, indices);
  const ref = useRef<HTMLLIElement | null>(null);

  // Scroll the selected row into view when it changes.
  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selected]);

  return (
    <li
      ref={ref}
      role="option"
      aria-selected={selected}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm',
        selected ? 'bg-indigo-500/15 text-white' : 'text-zinc-300 hover:bg-white/5',
      )}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ring-1',
          TYPE_COLOR[entry.type],
        )}>
        {TYPE_LABEL[entry.type]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">
          {segments.map((s, i) =>
            s.highlighted ? (
              <span key={i} className="font-semibold text-indigo-300">
                {s.text}
              </span>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </span>
        {entry.description ? (
          <span className="truncate text-[10px] text-zinc-500">{entry.description}</span>
        ) : null}
      </span>
      {entry.componentKey !== entry.label ? (
        <span className="ml-auto shrink-0 truncate text-[10px] text-zinc-600">
          {entry.componentKey}
        </span>
      ) : null}
    </li>
  );
}
