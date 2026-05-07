import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';

interface HeaderEntry {
  name: string;
  value: string;
  isSecret?: boolean;
}

interface HeadersConfigDialogProps {
  open: boolean;
  onClose: () => void;
  initialHeaders: HeaderEntry[];
  onSave: (headers: HeaderEntry[]) => void;
}

export function HeadersConfigDialog({ open, onClose, initialHeaders, onSave }: HeadersConfigDialogProps) {
  const [headers, setHeaders] = useState<HeaderEntry[]>(initialHeaders);

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { name: '', value: '', isSecret: false }]);
  }, []);

  const removeHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateHeader = useCallback((index: number, field: keyof HeaderEntry, val: string | boolean) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: val } : h)),
    );
  }, []);

  const handleSave = useCallback(() => {
    const valid = headers.filter((h) => h.name.trim().length > 0);
    onSave(valid);
    onClose();
  }, [headers, onSave, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHeaders(initialHeaders);
      dialogRef.current?.focus();
    }
  }, [open, initialHeaders]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="headers-dialog-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-[500px] max-h-[80vh] flex flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 id="headers-dialog-title" className="text-sm font-semibold">
            Runtime Headers
          </h2>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Close
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {headers.length === 0 && (
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">
              No global headers. Add headers that apply to every runtime request.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.name}
                  onChange={(e) => updateHeader(index, 'name', e.target.value)}
                  className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
                <input
                  type={header.isSecret ? 'password' : 'text'}
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
                <label className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
                  <input
                    type="checkbox"
                    checked={header.isSecret ?? false}
                    onChange={(e) => updateHeader(index, 'isSecret', e.target.checked)}
                  />
                  Secret
                </label>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-[var(--vscode-errorForeground)] hover:opacity-70"
                        onClick={() => removeHeader(index)}
                        aria-label="Remove header"
                      >
                        ✕
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-[11px]">
                      Remove
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>

          <button
            className="mt-3 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
            onClick={addHeader}
          >
            + Add header
          </button>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            onClick={handleSave}
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
