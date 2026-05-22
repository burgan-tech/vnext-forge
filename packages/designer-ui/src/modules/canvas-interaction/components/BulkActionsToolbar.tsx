import { memo } from 'react';
import { Copy, Trash2, Layers } from 'lucide-react';

/**
 * Floating action bar that materializes when the user has more
 * than one node selected (via the rectangle select rubber band).
 * Sits pinned to the top-center of the canvas, just below the
 * canvas toolbar / tab bar, so it's discoverable without
 * obscuring node content.
 *
 * Actions exposed:
 *   - Delete   → drops every selected user-state from the workflow
 *   - Duplicate → clones each selected state +40,+40 px offset
 *   - Group    → (future) wraps selection in a Group container
 *
 * Workflow-level pseudo-nodes (`__start__`, `__wf_*`) are
 * silently skipped by the parent handlers, so the user can't
 * accidentally delete them.
 */
export interface BulkActionsToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup?: () => void;
}

export const BulkActionsToolbar = memo(function BulkActionsToolbar({
  selectedCount,
  onDelete,
  onDuplicate,
  onGroup,
}: BulkActionsToolbarProps) {
  if (selectedCount < 2) return null;

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected items`}
      // `absolute` (not `fixed`) so the toolbar pins to the canvas
      // wrapper rather than the viewport. Keeps the bar inside
      // the canvas region so it doesn't collide with the host
      // shell's titlebar / tab strip / save buttons above.
      className="absolute left-1/2 top-3 z-30 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-border bg-surface/95 px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.04)] backdrop-blur-xl"
    >
      <span className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
        {selectedCount} selected
      </span>
      <span className="h-4 w-px bg-border" />

      <BulkButton
        icon={<Copy size={13} />}
        label="Duplicate"
        onClick={onDuplicate}
        shortcut="⌘D"
      />
      {onGroup && (
        <BulkButton icon={<Layers size={13} />} label="Group" onClick={onGroup} />
      )}
      <BulkButton
        icon={<Trash2 size={13} />}
        label="Delete"
        onClick={onDelete}
        shortcut="⌫"
        danger
      />
    </div>
  );
});

function BulkButton({
  icon,
  label,
  onClick,
  shortcut,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
        danger
          ? 'text-destructive-foreground hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      {icon}
      <span>{label}</span>
      {shortcut && (
        <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
