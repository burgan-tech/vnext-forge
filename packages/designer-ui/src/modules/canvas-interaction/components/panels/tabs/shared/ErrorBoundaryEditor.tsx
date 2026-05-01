import { useCallback } from 'react';
import type { ErrorBoundary, ErrorHandler } from '@vnext-forge/vnext-types';
import { ErrorHandlerCard } from './ErrorHandlerCard';
import { IconPlus, IconTrash } from '../PropertyPanelShared';
import { ShieldAlert, Plus } from 'lucide-react';

interface ErrorBoundaryEditorProps {
  errorBoundary: ErrorBoundary | undefined;
  onChange: (eb: ErrorBoundary | undefined) => void;
}

const DEFAULT_HANDLER: ErrorHandler = {
  action: 0,
  errorCodes: ['*'],
  priority: 100,
};

export function ErrorBoundaryEditor({ errorBoundary, onChange }: ErrorBoundaryEditorProps) {
  const handlers = errorBoundary?.onError ?? [];

  const createBoundary = useCallback(() => {
    onChange({ onError: [{ ...DEFAULT_HANDLER }] });
  }, [onChange]);

  const removeBoundary = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const updateHandler = useCallback((index: number, handler: ErrorHandler) => {
    const next = [...handlers];
    next[index] = handler;
    onChange({ onError: next });
  }, [handlers, onChange]);

  const removeHandler = useCallback((index: number) => {
    const next = handlers.filter((_, i) => i !== index);
    onChange(next.length > 0 ? { onError: next } : undefined);
  }, [handlers, onChange]);

  const addHandler = useCallback(() => {
    onChange({ onError: [...handlers, { ...DEFAULT_HANDLER }] });
  }, [handlers, onChange]);

  const moveHandler = useCallback((from: number, to: number) => {
    if (to < 0 || to >= handlers.length) return;
    const next = [...handlers];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ onError: next });
  }, [handlers, onChange]);

  if (!errorBoundary) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="bg-muted text-subtle flex size-12 items-center justify-center rounded-2xl">
          <ShieldAlert size={22} />
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-[11px] font-medium mb-1">
            No error boundary configured
          </div>
          <p className="text-subtle text-[10px] max-w-[220px] leading-relaxed">
            Add an error boundary to define how errors are handled during task execution.
          </p>
        </div>
        <button
          type="button"
          onClick={createBoundary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-muted hover:bg-secondary-muted/80 rounded-lg transition-colors cursor-pointer">
          <Plus size={13} />
          Add Error Boundary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Error handlers are evaluated by priority (lower = first). Add rules to handle specific error types or codes.
      </p>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-0.5">
        {handlers.map((handler, i) => (
          <ErrorHandlerCard
            key={i}
            handler={handler}
            index={i}
            total={handlers.length}
            onChange={(h) => updateHandler(i, h)}
            onRemove={() => removeHandler(i)}
            onMoveUp={() => moveHandler(i, i - 1)}
            onMoveDown={() => moveHandler(i, i + 1)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={addHandler}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add handler
        </button>
        <button
          type="button"
          onClick={removeBoundary}
          className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
          <IconTrash />
          Remove boundary
        </button>
      </div>
    </div>
  );
}
