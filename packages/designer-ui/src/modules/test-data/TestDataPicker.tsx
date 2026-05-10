import * as Dialog from '@radix-ui/react-dialog';
import { Beaker, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { fuzzyMatch } from '../quick-switcher/fuzzyMatch.js';

import { useTestDataStore } from './TestDataStore.js';
import type { SchemaComponentEntry } from './TestDataTypes.js';

export interface TestDataPickerProps {
  /** Active projectId (null hides the picker — there's nothing to pick). */
  projectId: string | null;
  /**
   * Loader for the project's Schema components. Host shell injects this
   * because the URL builder for the discovery API lives in apps/web (it
   * uses `vnext/schemas/list`). designer-ui itself stays router/transport
   * free.
   */
  loadSchemas(projectId: string): Promise<SchemaComponentEntry[]>;
}

/**
 * `Cmd+Shift+G` overlay: pick a Schema component from the active project,
 * generate a faker-driven random instance conforming to its embedded JSON
 * Schema, render the result with Copy / Regenerate buttons.
 *
 * Two-pane layout — left: filterable schema list, right: generated JSON
 * preview. Fuzzy filter mirrors QuickSwitcher / SnippetPicker behaviour;
 * the right pane stays in sync with whichever schema is selected. First
 * generation fires automatically on selection change so the user always
 * sees a live preview.
 */
export function TestDataPicker({ projectId, loadSchemas }: TestDataPickerProps) {
  const isOpen = useTestDataStore((s) => s.isOpen);
  const close = useTestDataStore((s) => s.close);
  const schemas = useTestDataStore((s) => s.schemas);
  const setSchemas = useTestDataStore((s) => s.setSchemas);
  const query = useTestDataStore((s) => s.query);
  const setQuery = useTestDataStore((s) => s.setQuery);
  const selectedKey = useTestDataStore((s) => s.selectedKey);
  const setSelectedKey = useTestDataStore((s) => s.setSelectedKey);
  const result = useTestDataStore((s) => s.result);
  const status = useTestDataStore((s) => s.status);
  const error = useTestDataStore((s) => s.error);
  const generateForSelected = useTestDataStore((s) => s.generateForSelected);

  const [copyHint, setCopyHint] = useState<string | null>(null);

  // ── load schemas when the picker opens for a project ────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadSchemas(projectId);
        if (!cancelled) setSchemas(list);
      } catch {
        // Surfaced via store error state on the next generate attempt.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, loadSchemas, setSchemas]);

  // ── auto-generate on selection change ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedKey) return;
    void generateForSelected();
    // selectedKey changes → re-run; we don't watch projectId because picker
    // closes on project change anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedKey]);

  // ── fuzzy filter the list as the user types ─────────────────────────────
  const filtered = useMemo<SchemaComponentEntry[]>(() => {
    if (!query.trim()) return schemas;
    const matches = schemas
      .map((entry) => ({ entry, match: fuzzyMatch(query, entry.label) }))
      .filter((m) => m.match !== null)
      .sort((a, b) => (b.match!.score - a.match!.score));
    return matches.map((m) => m.entry);
  }, [schemas, query]);

  function rendered(): string {
    if (!result) return '';
    try {
      return JSON.stringify(result.instance, null, 2);
    } catch {
      return String(result.instance);
    }
  }

  async function copy() {
    const text = rendered();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint('Copied!');
      setTimeout(() => setCopyHint(null), 1500);
    } catch {
      setCopyHint('Copy failed');
      setTimeout(() => setCopyHint(null), 2000);
    }
  }

  function regenerate() {
    void generateForSelected({ seed: Date.now() });
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content
          className="bg-surface text-foreground fixed left-1/2 top-[12%] z-50 flex h-[70vh] w-[90vw] max-w-5xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-zinc-800/60 shadow-2xl"
          aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Generate Test Data</Dialog.Title>

          {/* header */}
          <div className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
            <Beaker size={16} className="text-emerald-400" />
            <div className="text-sm font-semibold">Generate Test Data</div>
            <div className="text-foreground/50 text-xs">
              Pick a Schema component → faker-driven instance.
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* left: schema list */}
            <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800/60">
              <div className="border-b border-zinc-800/60 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter schemas…"
                  className="bg-background/60 text-foreground w-full rounded px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-foreground/50 p-3 text-xs">
                    {schemas.length === 0
                      ? 'No Schema components found in this project.'
                      : 'No matches.'}
                  </div>
                ) : (
                  filtered.map((entry) => {
                    const key = `${entry.group}/${entry.name}`;
                    const isSelected = selectedKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={
                          'block w-full truncate px-3 py-1.5 text-left text-xs ' +
                          (isSelected
                            ? 'bg-emerald-500/15 text-foreground'
                            : 'hover:bg-foreground/5 text-foreground/80')
                        }
                        title={entry.filePath}>
                        <div className="truncate">{entry.label}</div>
                        <div className="text-foreground/40 truncate font-mono text-[10px]">
                          {entry.filePath}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* right: preview */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2">
                <Sparkles size={12} className="text-emerald-400" />
                <div className="text-foreground/70 text-xs">
                  {status === 'loading'
                    ? 'Generating…'
                    : status === 'error'
                      ? 'Generation failed.'
                      : status === 'ready'
                        ? 'Generated instance — Copy or Regenerate.'
                        : 'Pick a schema to preview.'}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {copyHint ? (
                    <span className="text-emerald-400 text-[10px]">{copyHint}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={regenerate}
                    disabled={!selectedKey || status === 'loading'}
                    title="Regenerate with a fresh seed"
                    className="text-foreground/70 hover:text-foreground hover:bg-foreground/10 rounded p-1.5 disabled:opacity-40">
                    <RefreshCw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy()}
                    disabled={!result}
                    title="Copy JSON to clipboard"
                    className="text-foreground/70 hover:text-foreground hover:bg-foreground/10 rounded p-1.5 disabled:opacity-40">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <div className="bg-background/40 min-h-0 flex-1 overflow-auto">
                {error ? (
                  <pre className="text-rose-400 whitespace-pre-wrap p-4 text-xs">{error}</pre>
                ) : result ? (
                  <pre className="text-foreground/90 p-4 font-mono text-xs leading-relaxed">
                    {rendered()}
                  </pre>
                ) : status === 'loading' ? (
                  <div className="text-foreground/50 p-4 text-xs">Generating…</div>
                ) : (
                  <div className="text-foreground/40 p-4 text-xs">No preview yet.</div>
                )}
              </div>
              {result && 'schemaSourcePath' in result ? (
                <div className="text-foreground/40 truncate border-t border-zinc-800/60 px-4 py-1.5 font-mono text-[10px]">
                  source: {result.schemaSourcePath}
                </div>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
