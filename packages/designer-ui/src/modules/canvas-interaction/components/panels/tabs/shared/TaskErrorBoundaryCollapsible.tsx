import { useState, useCallback, useId } from 'react';
import { ChevronRight, ShieldAlert, Plus } from 'lucide-react';
import type { ErrorBoundary, ErrorHandler } from '@vnext-forge/vnext-types';
import { ErrorHandlerCard } from './ErrorHandlerCard';
import { IconPlus, IconTrash } from '../PropertyPanelShared';
import { getErrorActionLabel } from '../PropertyPanelHelpers';

interface TaskErrorBoundaryCollapsibleProps {
  errorBoundary: ErrorBoundary | undefined;
  onChange: (eb: ErrorBoundary | undefined) => void;
}

const DEFAULT_HANDLER: ErrorHandler = {
  action: 0,
  errorCodes: ['*'],
  priority: 100,
};

export function TaskErrorBoundaryCollapsible({
  errorBoundary,
  onChange,
}: TaskErrorBoundaryCollapsibleProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const handlers = errorBoundary?.onError ?? [];

  const addHandler = useCallback(() => {
    onChange({ onError: [...handlers, { ...DEFAULT_HANDLER }] });
  }, [handlers, onChange]);

  const updateHandler = useCallback(
    (index: number, handler: ErrorHandler) => {
      const next = [...handlers];
      next[index] = handler;
      onChange({ onError: next });
    },
    [handlers, onChange],
  );

  const removeHandler = useCallback(
    (index: number) => {
      const next = handlers.filter((_, i) => i !== index);
      onChange(next.length > 0 ? { onError: next } : undefined);
    },
    [handlers, onChange],
  );

  const moveHandler = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= handlers.length) return;
      const next = [...handlers];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange({ onError: next });
    },
    [handlers, onChange],
  );

  const removeBoundary = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const summaryText = (() => {
    if (handlers.length === 0) return null;
    const h = handlers[0];
    const matchTarget = h.errorTypes?.length
      ? h.errorTypes.join(', ')
      : h.errorCodes?.length
        ? h.errorCodes.join(', ')
        : '*';
    return `${getErrorActionLabel(h.action)} · ${matchTarget}`;
  })();

  return (
    <div className="border-t border-border">
      {/* Disclosure header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[36px] items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Error boundary${handlers.length > 0 ? `, ${handlers.length} handler${handlers.length > 1 ? 's' : ''}` : ', not set'}`}>
        <ShieldAlert size={13} className="text-muted-foreground shrink-0" aria-hidden />
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1 min-w-0">
          Error boundary
        </span>
        {handlers.length > 0 ? (
          <>
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold shrink-0">
              {handlers.length}
            </span>
            {summaryText && !open && (
              <span className="text-[9px] text-subtle truncate max-w-[80px]" aria-hidden>
                {summaryText}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px] text-subtle bg-muted px-1.5 py-0.5 rounded font-medium shrink-0">
            Not set
          </span>
        )}
        <ChevronRight
          size={12}
          className={`text-muted-foreground shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
      </button>

      {/* Disclosure body */}
      {open && (
        <div id={panelId} className="px-2.5 pb-2.5 pt-0.5">
          {handlers.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                Define how this task responds when execution fails.
              </p>
              <button
                type="button"
                onClick={addHandler}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-muted hover:bg-secondary-muted/80 rounded-lg transition-colors cursor-pointer">
                <Plus size={12} />
                Add error handler
              </button>
            </div>
          ) : (
            <>
              <p className="text-[9px] text-muted-foreground leading-relaxed mb-1.5">
                Handlers run in priority order (lower runs first).
              </p>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
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

              <div className="flex items-center justify-between gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={addHandler}
                  className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
                  <IconPlus />
                  Add handler
                </button>
                <button
                  type="button"
                  onClick={removeBoundary}
                  className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[9px] font-semibold transition-colors">
                  <IconTrash />
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
