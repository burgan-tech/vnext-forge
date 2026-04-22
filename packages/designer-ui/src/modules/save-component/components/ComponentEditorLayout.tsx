import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, Save, Undo2, Redo2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Alert, AlertDescription } from '../../../ui/Alert';

interface ComponentEditorLayoutProps {
  isDirty: boolean;
  hasSaved?: boolean;
  saving?: boolean;
  saveErrorMessage?: string | null;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  children: ReactNode;
  /**
   * Web shell: araç çubuğunu sekme satırına taşır (ör. `setToolbar`).
   * Verildiğinde üst breadcrumb ve yerel araç satırı çizilmez.
   */
  registerToolbar?: (toolbar: ReactNode | null) => void;
}

function StatusBadge({
  isDirty,
  hasSaved,
  compact,
}: {
  isDirty: boolean;
  hasSaved: boolean;
  compact: boolean;
}) {
  if (isDirty) {
    return (
      <span
        className="border-warning-border bg-warning-surface text-warning-text max-w-36 truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-none"
        title="Kaydedilmemiş değişiklikler">
        Modified
      </span>
    );
  }
  if (compact) return null;
  if (hasSaved) {
    return (
      <span className="border-success-border bg-success-surface rounded-full border px-3 py-1 font-medium text-success-text">
        Saved
      </span>
    );
  }
  return (
    <span className="border-border bg-muted/40 text-muted-foreground rounded-full border px-3 py-1 font-medium">
      No change
    </span>
  );
}

export function ComponentEditorLayout({
  isDirty,
  hasSaved = false,
  saving = false,
  saveErrorMessage = null,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
  registerToolbar,
}: ComponentEditorLayoutProps) {
  const compact = Boolean(registerToolbar);

  /** Araç çubuğu `useEffect` bağımlılıkları dışında tutuyoruz; aksi halde (ör. `onSave` her
   * render yeni) üst `setToolbar` döngüye girer. */
  const onSaveRef = useRef(onSave);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  onSaveRef.current = onSave;
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;

  const hasUndoGroup = Boolean(onUndo);
  const hasRedoButton = Boolean(onRedo);

  const toolbarNode = (
    <>
      <StatusBadge isDirty={isDirty} hasSaved={hasSaved} compact={compact} />
      {saving ? (
        <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Saving…</span>
      ) : null}
      {onUndo && (
        <div
          className="border-border bg-muted/30 flex items-center gap-px rounded border p-px"
          role="group"
          aria-label="Geçmiş">
          <Button
            type="button"
            onClick={() => onUndoRef.current?.()}
            disabled={!canUndo}
            variant="muted"
            size="sm"
            className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
            title="Geri al">
            <Undo2 size={compact ? 12 : 14} />
          </Button>
          {onRedo && (
            <Button
              type="button"
              onClick={() => onRedoRef.current?.()}
              disabled={!canRedo}
              variant="muted"
              size="sm"
              className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
              title="Yinele">
              <Redo2 size={compact ? 12 : 14} />
            </Button>
          )}
        </div>
      )}
      <Button
        type="button"
        onClick={() => onSaveRef.current()}
        disabled={!isDirty || saving}
        variant="success"
        size="sm"
        className={compact ? 'h-6 min-h-6 gap-1 px-2 text-[11px]' : ''}
        leftIconComponent={<Save size={compact ? 12 : 14} />}
        title="Save (Cmd+S)">
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </>
  );

  // `toolbarNode` yalnızca ilkel/eylem bayrakları (isDirty, canUndo, …) değişince yenilenmeli;
  // aksi halde `registerToolbar` + üstte `setState` sonsuz döngüye girebiliyor. onSave/Undo/Redo `ref`.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toolbarNode senkronu: yukarıdaki değerler
  useEffect(() => {
    if (!registerToolbar) return;
    registerToolbar(
      <div className="flex max-w-full shrink-0 items-center gap-1 sm:gap-1.5">{toolbarNode}</div>,
    );
    return () => {
      registerToolbar(null);
    };
  }, [
    registerToolbar,
    isDirty,
    hasSaved,
    saving,
    canUndo,
    canRedo,
    compact,
    hasUndoGroup,
    hasRedoButton,
  ]);

  const errorBlock =
    saveErrorMessage ? (
      <Alert variant="destructive" className="py-2">
        <AlertCircle />
        <AlertDescription className="truncate font-medium">{saveErrorMessage}</AlertDescription>
      </Alert>
    ) : null;

  if (registerToolbar) {
    return (
      <div className="flex h-full flex-col">
        {errorBlock ? <div className="border-border shrink-0 border-b px-3 py-2">{errorBlock}</div> : null}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border bg-background shrink-0 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <StatusBadge isDirty={isDirty} hasSaved={hasSaved} compact={false} />
            {saving ? (
              <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                Saving…
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onUndo && (
              <div
                className="border-border bg-muted/30 flex items-center gap-px rounded border p-px"
                role="group"
                aria-label="Geçmiş">
                <Button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  variant="muted"
                  size="sm"
                  className="min-w-8"
                  title="Undo">
                  <Undo2 size={14} />
                </Button>
                {onRedo && (
                  <Button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    variant="muted"
                    size="sm"
                    className="min-w-8"
                    title="Redo">
                    <Redo2 size={14} />
                  </Button>
                )}
              </div>
            )}
            <Button
              type="button"
              onClick={onSave}
              disabled={!isDirty || saving}
              variant="success"
              size="sm"
              leftIconComponent={<Save size={14} />}
              title="Save (Cmd+S)">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        {errorBlock ? <div className="mt-2">{errorBlock}</div> : null}
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
