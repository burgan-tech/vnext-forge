import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '../../lib/utils/cn.js';

import { listAllSnippets } from './SnippetsApi.js';
import { useSnippetsStore } from './SnippetsStore.js';
import {
  fuzzyMatchSnippet,
  highlightMatches,
  type SnippetFuzzyMatch,
} from './snippetFuzzy.js';
import { insertSnippetViaClipboard } from './snippetInsertion.js';
import type { Snippet, SnippetScope } from './SnippetTypes.js';

const RESULT_LIMIT = 80;

const SCOPE_LABEL: Record<SnippetScope, string> = {
  personal: 'Personal',
  project: 'Project',
};

const SCOPE_COLOR: Record<SnippetScope, string> = {
  personal: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
  project: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
};

interface RankedSnippet {
  snippet: Snippet;
  match: SnippetFuzzyMatch;
}

export interface SnippetPickerProps {
  /**
   * Active project id; required so project-scope snippets can be loaded.
   * `null` is a valid value (no project open) — picker still works for
   * personal snippets.
   */
  projectId: string | null;
}

/**
 * Cmd+Shift+S overlay. Mounts when `useSnippetsStore.pickerOpen` is true.
 * On open, fetches the snippet library (cached per projectId). Keyboard:
 * arrows navigate, Enter inserts (clipboard fallback), Esc closes.
 */
export function SnippetPicker({ projectId }: SnippetPickerProps) {
  const isOpen = useSnippetsStore((s) => s.pickerOpen);
  const personal = useSnippetsStore((s) => s.personal);
  const project = useSnippetsStore((s) => s.project);
  const status = useSnippetsStore((s) => s.status);
  const errorMessage = useSnippetsStore((s) => s.errorMessage);
  const cachedProjectId = useSnippetsStore((s) => s.cachedProjectId);
  const query = useSnippetsStore((s) => s.query);
  const selectedIndex = useSnippetsStore((s) => s.selectedIndex);
  const scopeFilter = useSnippetsStore((s) => s.scopeFilter);
  const languageHint = useSnippetsStore((s) => s.languageHint);

  const closePicker = useSnippetsStore((s) => s.closePicker);
  const setLoading = useSnippetsStore((s) => s.setLoading);
  const setLibrary = useSnippetsStore((s) => s.setLibrary);
  const setError = useSnippetsStore((s) => s.setError);
  const setQuery = useSnippetsStore((s) => s.setQuery);
  const setScopeFilter = useSnippetsStore((s) => s.setScopeFilter);
  const moveSelection = useSnippetsStore((s) => s.moveSelection);
  const setSelection = useSnippetsStore((s) => s.setSelection);

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Avoids the same useEffect-during-setLoading re-entry race we hit in
  // QuickSwitcher: a ref lets the resolve handler ignore late callbacks
  // without the cleanup-flag pattern that fights with status-changing deps.
  const inflightKeyRef = useRef<string | null>(null);

  // Fetch (or refetch) when the picker opens for a project we haven't cached.
  useEffect(() => {
    if (!isOpen) return;
    if (status === 'loading') return;
    const targetKey = projectId ?? '__no_project__';
    if (cachedProjectId === projectId && status === 'ready') return;
    if (inflightKeyRef.current === targetKey) return;

    inflightKeyRef.current = targetKey;
    setLoading();
    listAllSnippets(projectId ?? undefined)
      .then((res) => {
        if (inflightKeyRef.current !== targetKey) return;
        inflightKeyRef.current = null;
        setLibrary({
          personal: res.personal,
          project: res.project,
          warnings: res.warnings,
          projectId,
        });
      })
      .catch((err) => {
        if (inflightKeyRef.current !== targetKey) return;
        inflightKeyRef.current = null;
        setError(err instanceof Error && err.message ? err.message : 'Snippet load failed');
      });
  }, [isOpen, projectId, status, cachedProjectId, setLoading, setLibrary, setError]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const ranked: RankedSnippet[] = useMemo(() => {
    const all: Snippet[] =
      scopeFilter === 'personal'
        ? personal
        : scopeFilter === 'project'
          ? project
          : [...project, ...personal];
    const filtered = languageHint
      ? all.filter((s) => s.language === languageHint || s.language === 'plaintext')
      : all;
    const trimmed = query.trim();

    if (!trimmed) {
      return filtered.slice(0, RESULT_LIMIT).map((snippet) => ({
        snippet,
        match: { score: 0, indices: [] as number[] },
      }));
    }

    const scored: RankedSnippet[] = [];
    for (const snippet of filtered) {
      const labelMatch = fuzzyMatchSnippet(trimmed, snippet.name);
      const prefixMatch = fuzzyMatchSnippet(trimmed, snippet.prefix);
      const tagsMatch = (snippet.tags ?? [])
        .map((tag) => fuzzyMatchSnippet(trimmed, tag))
        .filter((m) => m !== null) as SnippetFuzzyMatch[];

      const best =
        labelMatch ??
        (prefixMatch
          ? { score: prefixMatch.score - 4, indices: [] }
          : tagsMatch.length > 0
            ? { score: Math.max(...tagsMatch.map((m) => m.score)) - 6, indices: [] }
            : null);

      if (best) scored.push({ snippet, match: best });
    }
    scored.sort((a, b) => b.match.score - a.match.score);
    return scored.slice(0, RESULT_LIMIT);
  }, [personal, project, scopeFilter, languageHint, query]);

  const handlePick = useCallback(
    async (snippet: Snippet) => {
      closePicker();
      await insertSnippetViaClipboard(snippet);
    },
    [closePicker],
  );

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
          void handlePick(picked.snippet);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      }
    },
    [moveSelection, ranked, selectedIndex, handlePick, closePicker],
  );

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closePicker();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-label="Snippet picker"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[15%] left-1/2 z-50 w-[min(90vw,640px)] -translate-x-1/2 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
          <DialogPrimitive.Title className="sr-only">Snippet picker</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and insert a snippet from your personal or project libraries.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search snippets by name, prefix, or tag..."
              className="flex-1 bg-transparent px-1 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <ScopeSegmented value={scopeFilter} onChange={setScopeFilter} />
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {status === 'loading' ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">Loading snippets…</div>
            ) : status === 'error' ? (
              <div className="px-3 py-8 text-center text-xs text-rose-400">
                {errorMessage ?? 'Snippet load failed'}
              </div>
            ) : ranked.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">
                {query
                  ? 'No matching snippets'
                  : personal.length + project.length === 0
                    ? 'No snippets yet — create one from the Snippets sidebar.'
                    : 'No snippets in this scope'}
              </div>
            ) : (
              <ul className="py-1">
                {ranked.map((r, i) => (
                  <SnippetRow
                    key={`${r.snippet.scope}:${r.snippet.id}`}
                    snippet={r.snippet}
                    indices={r.match.indices}
                    selected={i === selectedIndex}
                    onMouseEnter={() => setSelection(i)}
                    onClick={() => void handlePick(r.snippet)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[10px] text-zinc-500">
            <span>
              {ranked.length} match{ranked.length === 1 ? '' : 'es'}
            </span>
            <span>↑↓ navigate · ⏎ copy · esc close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ScopeSegmentedProps {
  value: 'all' | SnippetScope;
  onChange(value: 'all' | SnippetScope): void;
}

function ScopeSegmented({ value, onChange }: ScopeSegmentedProps) {
  const items: Array<{ id: 'all' | SnippetScope; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'project', label: 'Project' },
    { id: 'personal', label: 'Personal' },
  ];
  return (
    <div className="flex shrink-0 gap-0.5 rounded-md bg-white/5 p-0.5 text-[10px]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded px-2 py-0.5 transition-colors',
            value === item.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface SnippetRowProps {
  snippet: Snippet;
  indices: number[];
  selected: boolean;
  onMouseEnter(): void;
  onClick(): void;
}

function SnippetRow({ snippet, indices, selected, onMouseEnter, onClick }: SnippetRowProps) {
  const segments = highlightMatches(snippet.name, indices);
  const ref = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (selected && ref.current) ref.current.scrollIntoView({ block: 'nearest' });
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
          SCOPE_COLOR[snippet.scope],
        )}>
        {SCOPE_LABEL[snippet.scope]}
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
        <span className="truncate text-[10px] text-zinc-500">
          <code className="rounded bg-white/5 px-1 py-px text-zinc-400">{snippet.prefix}</code>
          {snippet.description ? <span className="ml-2">{snippet.description}</span> : null}
        </span>
      </span>
      <span className="ml-auto shrink-0 truncate text-[10px] text-zinc-600">
        {snippet.language}
      </span>
    </li>
  );
}
