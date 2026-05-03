import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../../../ui/Alert';
import { EditorDocumentToolbar } from './EditorDocumentToolbar.js';
import type { HostDocumentToolbarSlot } from './hostDocumentToolbarSlot.js';

export interface ComponentEditorLayoutProps {
  isDirty: boolean;
  hasSaved?: boolean;
  saving?: boolean;
  saveErrorMessage?: string | null;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Save the current file and deploy it via `wf update -f <path>`. */
  onPublish?: () => void;
  publishing?: boolean;
  /** Opens QuickRun panel for this workflow (flow editors only). */
  onOpenQuickRun?: () => void;
  /** Opens the documentation preview dialog (flow editors only). */
  onPreviewDocument?: () => void;
  children: ReactNode;
  /**
   * Dış "host"ta (yalnızca web sekme satırı) Save çubuğunu nereye takacağımız.
   * Verilmezse: VS Code webview gibi panellerde üst `editor-chrome` şeridi çizilir.
   */
  registerToolbar?: HostDocumentToolbarSlot;
  /** `modal`: dialog gövdesinde kompakt padding; toolbar `registerToolbar` ile host'ta. */
  surface?: 'panel' | 'modal';
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
  onPublish,
  publishing,
  onOpenQuickRun,
  onPreviewDocument,
  children,
  registerToolbar,
  surface = 'panel',
}: ComponentEditorLayoutProps) {
  /**
   * Host `ReactNode` slotta (`registerToolbar`) alt ağaç, editör re-render'larında
   * taze prop almayabiliyor. Gerçek handler'lar `ref` üzerinden daima güncel.
   */
  const onSaveRef = useRef(onSave);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onPublishRef = useRef(onPublish);
  const onOpenQuickRunRef = useRef(onOpenQuickRun);
  const onPreviewDocumentRef = useRef(onPreviewDocument);
  onSaveRef.current = onSave;
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;
  onPublishRef.current = onPublish;
  onOpenQuickRunRef.current = onOpenQuickRun;
  onPreviewDocumentRef.current = onPreviewDocument;

  const stableOnSave = useCallback(() => {
    onSaveRef.current();
  }, []);
  const stableOnUndo = useCallback(() => {
    onUndoRef.current?.();
  }, []);
  const stableOnRedo = useCallback(() => {
    onRedoRef.current?.();
  }, []);
  const stableOnPublish = useCallback(() => {
    onPublishRef.current?.();
  }, []);
  const stableOnOpenQuickRun = useCallback(() => {
    onOpenQuickRunRef.current?.();
  }, []);
  const stableOnPreviewDocument = useCallback(() => {
    onPreviewDocumentRef.current?.();
  }, []);

  const hasUndoGroup = Boolean(onUndo);
  const hasRedoButton = Boolean(onRedo);
  const hasPublish = Boolean(onPublish);
  const hasQuickRun = Boolean(onOpenQuickRun);
  const hasPreviewDocument = Boolean(onPreviewDocument);

  const hostToolbar = useMemo(
    () => (
      <EditorDocumentToolbar
        isDirty={isDirty}
        hasSaved={hasSaved}
        saving={saving}
        onSave={stableOnSave}
        onUndo={hasUndoGroup ? stableOnUndo : undefined}
        onRedo={hasRedoButton ? stableOnRedo : undefined}
        canUndo={canUndo}
        canRedo={canRedo}
        onPublish={hasPublish ? stableOnPublish : undefined}
        publishing={publishing}
        onOpenQuickRun={hasQuickRun ? stableOnOpenQuickRun : undefined}
        onPreviewDocument={hasPreviewDocument ? stableOnPreviewDocument : undefined}
        arrangement="host-row"
      />
    ),
    [
      isDirty,
      hasSaved,
      saving,
      canUndo,
      canRedo,
      hasUndoGroup,
      hasRedoButton,
      hasPublish,
      hasQuickRun,
      hasPreviewDocument,
      publishing,
      stableOnSave,
      stableOnUndo,
      stableOnRedo,
      stableOnPublish,
      stableOnOpenQuickRun,
      stableOnPreviewDocument,
    ],
  );

  const embeddedToolbar = (
    <EditorDocumentToolbar
      isDirty={isDirty}
      hasSaved={hasSaved}
      saving={saving}
      onSave={onSave}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      onPublish={onPublish}
      publishing={publishing}
      onOpenQuickRun={onOpenQuickRun}
      onPreviewDocument={onPreviewDocument}
      arrangement="editor-chrome"
    />
  );

  useEffect(() => {
    if (!registerToolbar) return;
    registerToolbar(hostToolbar);
    return () => {
      registerToolbar(null);
    };
  }, [registerToolbar, hostToolbar]);

  const errorBlock =
    saveErrorMessage ? (
      <Alert variant="destructive" className="py-2">
        <AlertCircle />
        <AlertDescription className="truncate font-medium">{saveErrorMessage}</AlertDescription>
      </Alert>
    ) : null;

  const bodyScrollClass =
    surface === 'modal'
      ? 'min-h-0 min-w-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3'
      : 'min-h-0 min-w-0 flex-1 overflow-y-auto';

  if (registerToolbar) {
    return (
      <div className={surface === 'modal' ? 'flex h-full max-h-full min-h-0 flex-col' : 'flex h-full flex-col'}>
        {errorBlock ? <div className="border-border shrink-0 border-b px-3 py-2">{errorBlock}</div> : null}
        <div className={bodyScrollClass}>{children}</div>
      </div>
    );
  }

  return (
    <div className={surface === 'modal' ? 'flex h-full max-h-full min-h-0 flex-col' : 'flex h-full flex-col'}>
      <div className="border-border bg-background shrink-0 border-b px-3 py-2">
        {embeddedToolbar}
        {errorBlock ? <div className="mt-2">{errorBlock}</div> : null}
      </div>

      <div className={bodyScrollClass}>{children}</div>
    </div>
  );
}
