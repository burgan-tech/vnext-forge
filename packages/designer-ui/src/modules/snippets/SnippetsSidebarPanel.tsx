import { useCallback, useEffect } from 'react';

import { Copy, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { showNotification } from '../../notification/notification-port.js';
import { cn } from '../../lib/utils/cn.js';

import {
  deleteSnippet,
  listAllSnippets,
  openSnippetLocation,
} from './SnippetsApi.js';
import { SnippetEditor } from './SnippetEditor.js';
import { useSnippetsStore } from './SnippetsStore.js';
import { insertSnippetViaClipboard } from './snippetInsertion.js';
import type { Snippet, SnippetScope } from './SnippetTypes.js';

export interface SnippetsSidebarPanelProps {
  /** Active project id; null = no project = only personal snippets are shown. */
  projectId: string | null;
}

/**
 * Sidebar panel for the Snippets activity. Two scope sections (Project on
 * top, Personal on bottom). Each row carries copy / edit / delete / reveal
 * actions; the section header has a "new" button that opens the
 * SnippetEditor in `create` mode for that scope.
 *
 * Auto-refetches when projectId changes.
 */
export function SnippetsSidebarPanel({ projectId }: SnippetsSidebarPanelProps) {
  const personal = useSnippetsStore((s) => s.personal);
  const project = useSnippetsStore((s) => s.project);
  const status = useSnippetsStore((s) => s.status);
  const errorMessage = useSnippetsStore((s) => s.errorMessage);
  const cachedProjectId = useSnippetsStore((s) => s.cachedProjectId);
  const setLoading = useSnippetsStore((s) => s.setLoading);
  const setLibrary = useSnippetsStore((s) => s.setLibrary);
  const setError = useSnippetsStore((s) => s.setError);
  const startCreate = useSnippetsStore((s) => s.startCreate);
  const startEdit = useSnippetsStore((s) => s.startEdit);

  const refresh = useCallback(async () => {
    setLoading();
    try {
      const res = await listAllSnippets(projectId ?? undefined);
      setLibrary({
        personal: res.personal,
        project: res.project,
        warnings: res.warnings,
        projectId,
      });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Snippet load failed');
    }
  }, [projectId, setLoading, setLibrary, setError]);

  // Refetch on mount and when projectId changes.
  useEffect(() => {
    if (status === 'loading') return;
    if (cachedProjectId === projectId && status === 'ready') return;
    void refresh();
  }, [projectId, status, cachedProjectId, refresh]);

  const handleDelete = useCallback(
    async (snippet: Snippet) => {
      const ok = window.confirm(
        `Delete snippet "${snippet.name}"? This removes ${snippet.sourcePath} from disk.`,
      );
      if (!ok) return;
      try {
        await deleteSnippet(snippet.scope, snippet.id, projectId ?? undefined);
        showNotification({
          kind: 'success',
          message: `Snippet "${snippet.name}" deleted.`,
        });
        await refresh();
      } catch (err) {
        showNotification({
          kind: 'error',
          message: err instanceof Error && err.message ? err.message : 'Delete failed',
        });
      }
    },
    [projectId, refresh],
  );

  const handleReveal = useCallback(
    async (scope: SnippetScope, id?: string) => {
      try {
        const result = await openSnippetLocation(scope, {
          ...(id ? { id } : {}),
          ...(projectId ? { projectId } : {}),
        });
        // We can't actually reveal in Finder/Explorer from the renderer (no
        // shell.openPath), but we can copy the path so the user can do it.
        await navigator.clipboard.writeText(result.path);
        showNotification({
          kind: 'info',
          message: `Path copied: ${result.path}`,
          durationMs: 5000,
        });
      } catch (err) {
        showNotification({
          kind: 'error',
          message: err instanceof Error && err.message ? err.message : 'Could not resolve path',
        });
      }
    },
    [projectId],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h2 className="text-[11px] font-semibold tracking-wide text-zinc-300 uppercase">
          Snippets
        </h2>
        <button
          type="button"
          onClick={() => void refresh()}
          title="Refresh"
          className="text-zinc-500 hover:text-zinc-200">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {status === 'loading' ? (
        <div className="px-3 py-6 text-center text-[11px] text-zinc-500">Loading…</div>
      ) : status === 'error' ? (
        <div className="px-3 py-6 text-center text-[11px] text-rose-400">
          {errorMessage ?? 'Could not load snippets.'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <Section
            label="Project"
            scope="project"
            snippets={project}
            disabled={!projectId}
            disabledHint={projectId ? null : 'Open a project to manage project snippets.'}
            onCreate={() => startCreate('project')}
            onEdit={(s) => startEdit('project', s.id)}
            onDelete={handleDelete}
            onReveal={(id) => void handleReveal('project', id)}
            onRevealRoot={() => void handleReveal('project')}
          />
          <Section
            label="Personal"
            scope="personal"
            snippets={personal}
            onCreate={() => startCreate('personal')}
            onEdit={(s) => startEdit('personal', s.id)}
            onDelete={handleDelete}
            onReveal={(id) => void handleReveal('personal', id)}
            onRevealRoot={() => void handleReveal('personal')}
          />
        </div>
      )}

      <SnippetEditor projectId={projectId} onSaved={() => void refresh()} />
    </div>
  );
}

interface SectionProps {
  label: string;
  scope: SnippetScope;
  snippets: Snippet[];
  disabled?: boolean;
  disabledHint?: string | null;
  onCreate(): void;
  onEdit(snippet: Snippet): void;
  onDelete(snippet: Snippet): void;
  onReveal(id: string): void;
  onRevealRoot(): void;
}

function Section({
  label,
  scope,
  snippets,
  disabled,
  disabledHint,
  onCreate,
  onEdit,
  onDelete,
  onReveal,
  onRevealRoot,
}: SectionProps) {
  return (
    <section className="mt-2 first:mt-0">
      <header className="flex items-center justify-between px-1 py-1">
        <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
          {label} <span className="text-zinc-600">({snippets.length})</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRevealRoot}
            title="Copy library path"
            className={cn(
              'rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
              disabled && 'opacity-50',
            )}>
            <FolderOpen className="size-3" />
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            title={disabled ? (disabledHint ?? 'Disabled') : 'New snippet'}
            className={cn(
              'rounded p-0.5 text-zinc-400 hover:bg-white/5 hover:text-white',
              disabled && 'opacity-40',
            )}>
            <Plus className="size-3.5" />
          </button>
        </div>
      </header>

      {disabled && disabledHint ? (
        <div className="px-1 py-2 text-[10px] text-zinc-600">{disabledHint}</div>
      ) : snippets.length === 0 ? (
        <div className="px-1 py-2 text-[10px] text-zinc-600">No {label.toLowerCase()} snippets yet.</div>
      ) : (
        <ul className="flex flex-col">
          {snippets.map((snippet) => (
            <SnippetRow
              key={`${scope}:${snippet.id}`}
              snippet={snippet}
              onCopy={() => void insertSnippetViaClipboard(snippet)}
              onEdit={() => onEdit(snippet)}
              onDelete={() => void onDelete(snippet)}
              onReveal={() => onReveal(snippet.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface SnippetRowProps {
  snippet: Snippet;
  onCopy(): void;
  onEdit(): void;
  onDelete(): void;
  onReveal(): void;
}

function SnippetRow({ snippet, onCopy, onEdit, onDelete, onReveal }: SnippetRowProps) {
  return (
    <li className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-white/5">
      <button
        type="button"
        onClick={onCopy}
        title="Copy to clipboard"
        className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-[12px] text-zinc-200">{snippet.name}</span>
        <span className="truncate text-[10px] text-zinc-500">
          <code className="rounded bg-white/5 px-1">{snippet.prefix}</code>
          <span className="ml-1.5 text-zinc-600">{snippet.language}</span>
          {snippet.tags && snippet.tags.length > 0 ? (
            <span className="ml-1.5 text-zinc-600">· {snippet.tags.join(', ')}</span>
          ) : null}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <IconButton title="Copy" onClick={onCopy}>
          <Copy className="size-3" />
        </IconButton>
        <IconButton title="Edit" onClick={onEdit}>
          <Pencil className="size-3" />
        </IconButton>
        <IconButton title="Reveal path" onClick={onReveal}>
          <FolderOpen className="size-3" />
        </IconButton>
        <IconButton title="Delete" onClick={onDelete}>
          <Trash2 className="size-3 text-rose-300" />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}
