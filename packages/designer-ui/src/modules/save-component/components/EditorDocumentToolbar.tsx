import { Redo2, Rocket, Save, Undo2 } from 'lucide-react';
import { Button } from '../../../ui/Button';

export type EditorDocumentToolbarArrangement = 'host-row' | 'editor-chrome';

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

export interface EditorDocumentToolbarProps {
  isDirty: boolean;
  hasSaved: boolean;
  saving: boolean;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Save the current file and deploy it via `wf update -f <path>`. */
  onPublish?: () => void;
  publishing?: boolean;
  /**
   * - `host-row`: Web'deki sekme satırı sağı (kompakt).
   * - `editor-chrome`: Extension webview'da panelin üst şeridi (daha geniş).
   */
  arrangement: EditorDocumentToolbarArrangement;
}

/**
 * vNext component editörlerinde paylaşılan Save / durum / geri al çubuğu.
 * `ComponentEditorLayout` bu bileşeni hem web "host slota" hem panel içi chrome'a basar.
 */
export function EditorDocumentToolbar({
  isDirty,
  hasSaved,
  saving,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPublish,
  publishing,
  arrangement,
}: EditorDocumentToolbarProps) {
  const compact = arrangement === 'host-row';
  const iconSm = compact ? 12 : 14;

  const savingLabel = (
    <span className="text-info-text text-[10px] font-medium">Saving…</span>
  );

  const historyGroup =
    onUndo != null ? (
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
          className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
          title="Geri al">
          <Undo2 size={iconSm} />
        </Button>
        {onRedo != null ? (
          <Button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            variant="muted"
            size="sm"
            className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
            title="Yinele">
            <Redo2 size={iconSm} />
          </Button>
        ) : null}
      </div>
    ) : null;

  const saveButton = (
    <Button
      type="button"
      onClick={onSave}
      disabled={!isDirty || saving}
      variant="success"
      size="sm"
      className={compact ? 'h-6 min-h-6 gap-1 px-2 text-[11px]' : ''}
      leftIconComponent={<Save size={iconSm} />}
      title="Save (Cmd+S)">
      {saving ? 'Saving...' : 'Save'}
    </Button>
  );

  const publishButton =
    onPublish != null ? (
      <Button
        type="button"
        onClick={onPublish}
        disabled={saving || publishing}
        variant="default"
        size="sm"
        className={compact ? 'h-6 min-h-6 gap-1 px-2 text-[11px]' : ''}
        leftIconComponent={<Rocket size={iconSm} />}
        title="Save and deploy via wf CLI">
        {publishing ? 'Publishing...' : 'Publish'}
      </Button>
    ) : null;

  if (arrangement === 'host-row') {
    return (
      <div className="flex max-w-full shrink-0 items-center gap-1 sm:gap-1.5">
        <StatusBadge isDirty={isDirty} hasSaved={hasSaved} compact={compact} />
        {saving ? savingLabel : null}
        {historyGroup}
        {saveButton}
        {publishButton}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <StatusBadge isDirty={isDirty} hasSaved={hasSaved} compact={false} />
        {saving ? savingLabel : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {historyGroup}
        {saveButton}
        {publishButton}
      </div>
    </div>
  );
}
