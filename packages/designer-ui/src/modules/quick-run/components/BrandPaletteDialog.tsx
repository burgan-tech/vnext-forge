/**
 * Brand JSON picker — file-based.
 *
 * Source of truth is the workspace file `<project>/.vnext-forge/brand.json`.
 * Apply writes to it; Clear deletes it. `useBrandPaletteFromWorkspace`
 * reads the file in every webview and pushes the content into the settings
 * store, so the preview pipeline (BrandPaletteSync + PseudoUiPseudoViewFrame)
 * is triggered automatically. This keeps the Quick Run panel and the
 * view-editor panel in sync even though they run in separate webview
 * iframes.
 *
 * Error handling:
 *   - Invalid JSON → Apply disabled + red banner.
 *   - No active project → Apply/Clear disabled + info banner.
 *   - Disk write fails → red banner; dialog stays open.
 */
import { useEffect, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../ui/Dialog';
import { Textarea } from '../../../ui/Textarea';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  deleteFile,
  writeFile,
  readOptionalFile,
} from '../../project-workspace/WorkspaceApi';
import {
  BRAND_PALETTE_FILE_RELATIVE,
  buildBrandPaletteFilePath,
} from '../../../app/useBrandPaletteFromWorkspace';
import { isFailure } from '@vnext-forge-studio/app-contracts';

export interface BrandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandPaletteDialog({ open, onOpenChange }: BrandPaletteDialogProps) {
  // Store value is read for the "active brand" indicator only.
  const brandPalette = useSettingsStore((s) => s.pseudoUiBrandPalette);
  const activeProjectPath = useProjectStore((s) => s.activeProject?.path ?? null);

  const [draft, setDraft] = useState(brandPalette ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On open, load the latest brand from disk into the draft.
  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setIoError(null);

    if (!activeProjectPath) {
      setDraft(brandPalette ?? '');
      return;
    }

    let cancelled = false;
    const brandFilePath = buildBrandPaletteFilePath(activeProjectPath);
    readOptionalFile(brandFilePath)
      .then((result) => {
        if (cancelled) return;
        setDraft(result ? result.content : '');
      })
      .catch((err) => {
        if (cancelled) return;
        // A read failure when opening the dialog is non-fatal — fall back to empty.
        console.warn('[BrandPaletteDialog] read failed:', err);
        setDraft('');
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeProjectPath, brandPalette]);

  function validateDraft(value: string): string | null {
    if (value.trim().length === 0) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    setValidationError(validateDraft(value));
    setIoError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      handleDraftChange(text);
    };
    reader.onerror = () => {
      setValidationError('Failed to read file: ' + (reader.error?.message ?? 'unknown error'));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleApply() {
    if (!activeProjectPath) {
      setIoError('No active project — cannot write the brand JSON.');
      return;
    }
    const trimmed = draft.trim();
    const brandFilePath = buildBrandPaletteFilePath(activeProjectPath);

    setBusy(true);
    setIoError(null);
    try {
      if (trimmed.length === 0) {
        // Empty draft = clear (delete the file).
        const res = await deleteFile(brandFilePath);
        if (isFailure(res)) {
          // Missing file is not an error here.
          const msg = res.error.message ?? '';
          if (!/not.?found|enoent/i.test(msg)) {
            setIoError(`Failed to delete brand file: ${msg}`);
            return;
          }
        }
      } else {
        const res = await writeFile(brandFilePath, trimmed);
        if (isFailure(res)) {
          setIoError(`Failed to write brand file: ${res.error.message ?? 'unknown error'}`);
          return;
        }
      }
      onOpenChange(false);
    } catch (err) {
      setIoError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!activeProjectPath) {
      setIoError('No active project — cannot delete the brand JSON.');
      return;
    }
    const brandFilePath = buildBrandPaletteFilePath(activeProjectPath);
    setBusy(true);
    setIoError(null);
    try {
      const res = await deleteFile(brandFilePath);
      if (isFailure(res)) {
        const msg = res.error.message ?? '';
        if (!/not.?found|enoent/i.test(msg)) {
          setIoError(`Failed to delete brand file: ${msg}`);
          return;
        }
      }
      setDraft('');
      onOpenChange(false);
    } catch (err) {
      setIoError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const hasProject = activeProjectPath !== null;
  const canApply = hasProject && validationError === null && !busy;
  const canClear = hasProject && !busy && (brandPalette !== null || draft.trim().length > 0);
  const hasBrand = brandPalette !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Brand JSON Palette</DialogTitle>
          <DialogDescription>
            Upload a brand JSON file or paste JSON directly. On Apply the content is written to
            <code>{' '}{BRAND_PALETTE_FILE_RELATIVE}</code> and applied to every open Forge tab
            (Quick Run, view editor) instantly.
            {hasBrand && (
              <span className="ml-1 text-[var(--vscode-textLink-foreground)]">
                · a brand palette is currently active
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-4 pb-2">
          {!hasProject && (
            <div
              role="alert"
              className="rounded border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] px-3 py-2 text-xs text-[var(--vscode-inputValidation-warningForeground)]"
            >
              No active project — open a vnext project first to save a brand JSON.
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Choose brand JSON file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-[var(--vscode-panel-border)] px-3 py-1 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            >
              Choose JSON file…
            </button>
            <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">
              or paste JSON below
            </span>
          </div>

          <Textarea
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={`{\n  "name": "Burgan Light",\n  "brightness": "light",\n  "palette": {\n    "brand": { "primary": "#FF6B00" }\n  }\n}`}
            className="min-h-[280px] font-mono text-xs"
            spellCheck={false}
            aria-label="Brand JSON content"
          />

          {validationError !== null && (
            <div
              role="alert"
              className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-xs text-[var(--vscode-inputValidation-errorForeground)]"
            >
              JSON error: {validationError}
            </div>
          )}

          {ioError !== null && (
            <div
              role="alert"
              className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-xs text-[var(--vscode-inputValidation-errorForeground)]"
            >
              {ioError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={!canClear}
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1 text-xs hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="rounded border border-[var(--vscode-panel-border)] px-3 py-1 text-xs hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
