import { useCallback, useEffect, useState } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { showNotification } from '../../notification/notification-port.js';
import { cn } from '../../lib/utils/cn.js';

import { getSnippet, saveSnippet } from './SnippetsApi.js';
import { useSnippetsStore } from './SnippetsStore.js';
import type { SnippetFile, SnippetLanguage, SnippetScope } from './SnippetTypes.js';

const LANGUAGES: SnippetLanguage[] = ['csx', 'json', 'plaintext'];

export interface SnippetEditorProps {
  /** Active project id; required for project-scope saves. */
  projectId: string | null;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: () => void;
}

interface FormState {
  name: string;
  prefix: string;
  language: SnippetLanguage;
  description: string;
  body: string;
  tagsText: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  prefix: '',
  language: 'csx',
  description: '',
  body: '',
  tagsText: '',
};

/**
 * Modal form for creating or editing a snippet. Mounts when
 * `useSnippetsStore.editing` is non-null. Body is a multiline `<textarea>`
 * — we intentionally keep this dependency-free so designer-ui doesn't pull
 * Monaco into the snippets module just for editing.
 */
export function SnippetEditor({ projectId, onSaved }: SnippetEditorProps) {
  const editing = useSnippetsStore((s) => s.editing);
  const closeEditor = useSnippetsStore((s) => s.closeEditor);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOpen = editing !== null;

  // Hydrate the form when the editor opens.
  useEffect(() => {
    if (!editing) {
      setForm(EMPTY_FORM);
      setErrorMessage(null);
      setBusy(false);
      return;
    }
    if (editing.mode === 'create') {
      setForm(EMPTY_FORM);
      setErrorMessage(null);
      return;
    }
    // edit mode → load existing
    let cancelled = false;
    setBusy(true);
    setErrorMessage(null);
    getSnippet(editing.scope, editing.id!, projectId ?? undefined)
      .then((snippet) => {
        if (cancelled) return;
        setForm({
          name: snippet.name,
          prefix: snippet.prefix,
          language: snippet.language,
          description: snippet.description ?? '',
          body: snippet.body.join('\n'),
          tagsText: (snippet.tags ?? []).join(', '),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error && err.message ? err.message : 'Failed to load snippet',
        );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, projectId]);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!form.name.trim() || !form.prefix.trim()) {
      setErrorMessage('Name and prefix are required.');
      return;
    }
    if (editing.scope === 'project' && !projectId) {
      setErrorMessage('Project snippets need an open project.');
      return;
    }

    const payload: SnippetFile = {
      name: form.name.trim(),
      prefix: form.prefix.trim(),
      language: form.language,
      body: form.body.replace(/\r\n/g, '\n').split('\n'),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.tagsText.trim()
        ? {
            tags: form.tagsText
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          }
        : {}),
    };

    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await saveSnippet(editing.scope, payload, {
        ...(editing.id ? { id: editing.id } : {}),
        ...(projectId ? { projectId } : {}),
      });
      showNotification({
        kind: 'success',
        message: result.created
          ? `Snippet "${result.snippet.name}" created.`
          : `Snippet "${result.snippet.name}" updated.`,
      });
      closeEditor();
      onSaved?.();
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message ? err.message : 'Failed to save snippet.',
      );
    } finally {
      setBusy(false);
    }
  }, [editing, form, projectId, closeEditor, onSaved]);

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-label={editing?.mode === 'create' ? 'Create snippet' : 'Edit snippet'}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-zinc-950/95 p-4 shadow-2xl">
          <DialogPrimitive.Title className="text-sm font-semibold text-white">
            {editing?.mode === 'create' ? 'New snippet' : 'Edit snippet'}
            <span className="ml-2 text-[10px] font-normal text-zinc-500">
              {editing?.scope === 'project' ? 'Project library' : 'Personal library'}
            </span>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Define a reusable code snippet with name, prefix, language, body, and optional tags.
          </DialogPrimitive.Description>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <input
                value={form.name}
                disabled={busy}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400/50"
                placeholder="HTTP error handler"
                autoFocus
              />
            </Field>
            <Field label="Prefix" required hint="Type to search in the picker">
              <input
                value={form.prefix}
                disabled={busy}
                onChange={(e) => setForm((s) => ({ ...s, prefix: e.target.value }))}
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400/50"
                placeholder="httperr"
              />
            </Field>
            <Field label="Language">
              <select
                value={form.language}
                disabled={busy}
                onChange={(e) =>
                  setForm((s) => ({ ...s, language: e.target.value as SnippetLanguage }))
                }
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400/50">
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags" hint="Comma-separated">
              <input
                value={form.tagsText}
                disabled={busy}
                onChange={(e) => setForm((s) => ({ ...s, tagsText: e.target.value }))}
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400/50"
                placeholder="error, http"
              />
            </Field>
            <Field label="Description" className="col-span-2">
              <input
                value={form.description}
                disabled={busy}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400/50"
                placeholder="One-liner shown under the snippet name"
              />
            </Field>
            <Field label="Body" required className="col-span-2">
              <textarea
                value={form.body}
                disabled={busy}
                onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
                className="h-48 w-full resize-y rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[12px] text-white outline-none focus:border-indigo-400/50"
                placeholder={'// Use ${1:placeholder} for tab stops\nLogError("$1", ex.Message);\n$0'}
                spellCheck={false}
              />
            </Field>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={closeEditor}
              className="rounded border border-white/10 bg-transparent px-3 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className={cn(
                'rounded border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-100',
                busy ? 'opacity-50' : 'hover:bg-indigo-500/30',
              )}>
              {busy ? 'Saving…' : editing?.mode === 'create' ? 'Create snippet' : 'Save changes'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, hint, required, className, children }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
        {required ? <span className="text-rose-300"> *</span> : null}
        {hint ? <span className="ml-2 lowercase text-zinc-600">— {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
