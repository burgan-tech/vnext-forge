import type { ReactNode } from 'react';
import { FileText, Play, Redo2, Rocket, Save, Undo2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';

export type EditorDocumentToolbarArrangement = 'host-row' | 'editor-chrome';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'muted' | 'ghost';
  className?: string;
}

function IconButton({ icon, label, onClick, disabled, variant = 'muted', className }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          onClick={onClick}
          disabled={disabled}
          variant={variant}
          size="icon"
          className={`size-7 min-h-7 ${className ?? ''}`}
          aria-label={label}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({
  isDirty,
  hasSaved,
  autoSaved,
  autoSavePending,
  compact,
}: {
  isDirty: boolean;
  hasSaved: boolean;
  autoSaved?: boolean;
  autoSavePending?: boolean;
  compact: boolean;
}) {
  if (isDirty) {
    const title = autoSavePending ? 'Auto-save in a moment\u2026' : 'Unsaved changes';
    return (
      <span
        className="border-warning-border bg-warning-surface text-warning-text max-w-36 truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-none"
        title={title}
        aria-live="polite">
        Modified
      </span>
    );
  }
  if (compact) {
    if (autoSaved) {
      return (
        <span
          className="border-success-border bg-success-surface text-success-text max-w-36 truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-none"
          title="Changes saved automatically"
          aria-live="polite">
          Auto-saved
        </span>
      );
    }
    return null;
  }
  if (autoSaved) {
    return (
      <span
        className="border-success-border bg-success-surface rounded-full border px-3 py-1 font-medium text-success-text"
        title="Changes saved automatically"
        aria-live="polite">
        Auto-saved
      </span>
    );
  }
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
  onPublish?: () => void;
  publishing?: boolean;
  onOpenQuickRun?: () => void;
  onPreviewDocument?: () => void;
  autoSavePending?: boolean;
  autoSaved?: boolean;
  /**
   * - `host-row`: compact row in the web tab bar.
   * - `editor-chrome`: wider panel chrome in extension webview.
   */
  arrangement: EditorDocumentToolbarArrangement;
}

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
  onOpenQuickRun,
  onPreviewDocument,
  autoSavePending,
  autoSaved,
  arrangement,
}: EditorDocumentToolbarProps) {
  const compact = arrangement === 'host-row';
  const iconSize = compact ? 13 : 14;

  const savingLabel = (
    <span className="text-info-text text-[10px] font-medium">Saving…</span>
  );

  const historyGroup =
    onUndo != null ? (
      <div
        className="border-border bg-muted/30 flex items-center gap-px rounded border p-px"
        role="group"
        aria-label="History">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              variant="muted"
              size="sm"
              className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
              aria-label="Undo">
              <Undo2 size={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[11px]">Undo</TooltipContent>
        </Tooltip>
        {onRedo != null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                variant="muted"
                size="sm"
                className={compact ? 'h-6 min-h-6 min-w-6 px-0' : 'min-w-8'}
                aria-label="Redo">
                <Redo2 size={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">Redo</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    ) : null;

  const saveBtn = (
    <IconButton
      icon={<Save size={iconSize} />}
      label={saving ? 'Saving...' : 'Save (Cmd+S)'}
      onClick={onSave}
      disabled={!isDirty || saving}
      variant="success"
    />
  );

  const previewDocBtn =
    onPreviewDocument != null ? (
      <IconButton
        icon={<FileText size={iconSize} />}
        label="Preview Document"
        onClick={onPreviewDocument}
      />
    ) : null;

  const quickRunBtn =
    onOpenQuickRun != null ? (
      <IconButton
        icon={<Play size={iconSize} />}
        label="Quick Run"
        onClick={onOpenQuickRun}
      />
    ) : null;

  const publishBtn =
    onPublish != null ? (
      <IconButton
        icon={<Rocket size={iconSize} />}
        label={publishing ? 'Publishing...' : 'Publish'}
        onClick={onPublish}
        disabled={saving || publishing}
        variant="default"
      />
    ) : null;

  if (arrangement === 'host-row') {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex max-w-full shrink-0 items-center gap-1 sm:gap-1.5">
          <StatusBadge isDirty={isDirty} hasSaved={hasSaved} autoSaved={autoSaved} autoSavePending={autoSavePending} compact={compact} />
          {saving ? savingLabel : null}
          {historyGroup}
          {saveBtn}
          {previewDocBtn}
          {quickRunBtn}
          {publishBtn}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <StatusBadge isDirty={isDirty} hasSaved={hasSaved} autoSaved={autoSaved} autoSavePending={autoSavePending} compact={false} />
          {saving ? savingLabel : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {historyGroup}
          {saveBtn}
          {previewDocBtn}
          {quickRunBtn}
          {publishBtn}
        </div>
      </div>
    </TooltipProvider>
  );
}
