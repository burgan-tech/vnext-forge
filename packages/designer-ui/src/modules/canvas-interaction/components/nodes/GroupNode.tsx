import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';

interface GroupData {
  label: string;
  color?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';
  [key: string]: unknown;
}

/**
 * Tailwind palette per color key for group containers. Slightly
 * desaturated so the container reads as a *backdrop* rather than
 * a foreground element — the state nodes inside it should remain
 * the focal point.
 */
const COLOR_CLASSES: Record<NonNullable<GroupData['color']>, string> = {
  slate: 'bg-slate-500/5 border-slate-400/40 dark:bg-slate-300/5 dark:border-slate-500/40',
  indigo: 'bg-indigo-500/8 border-indigo-400/45 dark:bg-indigo-300/8 dark:border-indigo-400/45',
  emerald: 'bg-emerald-500/8 border-emerald-400/45 dark:bg-emerald-300/8 dark:border-emerald-400/45',
  amber: 'bg-amber-500/10 border-amber-400/50 dark:bg-amber-300/10 dark:border-amber-400/50',
  rose: 'bg-rose-500/8 border-rose-400/45 dark:bg-rose-300/8 dark:border-rose-400/45',
};

const LABEL_TEXT_CLASSES: Record<NonNullable<GroupData['color']>, string> = {
  slate: 'text-slate-700 dark:text-slate-300',
  indigo: 'text-indigo-700 dark:text-indigo-200',
  emerald: 'text-emerald-700 dark:text-emerald-200',
  amber: 'text-amber-800 dark:text-amber-200',
  rose: 'text-rose-700 dark:text-rose-200',
};

/**
 * Group / Lane container — a translucent rectangle that visually
 * groups a set of states. Behavior:
 *
 *  - Always renders BEHIND state nodes (`zIndex: -1` on the
 *    React Flow node entry, set in `workflowToReactFlow`).
 *  - The label sits in the top-left corner as a tag-style chip.
 *  - The group itself is a non-blocking *backdrop*: it doesn't
 *    own its child states, doesn't move them when dragged, and
 *    doesn't constrain selection. It's purely a visual hint.
 *
 * Editing model: same as `NoteNode` — double-click to enter
 * label edit mode, commit on blur or Escape. The hover toolbar
 * (top-right) exposes Rename + Delete.
 */
export const GroupNode = memo(function GroupNode({ id, data, selected }: NodeProps) {
  const d = data as GroupData;
  const colorKey = d.color ?? 'slate';
  const palette = COLOR_CLASSES[colorKey];
  const labelText = LABEL_TEXT_CLASSES[colorKey];

  const updateDiagram = useWorkflowStore((s) => s.updateDiagram);
  const [draftLabel, setDraftLabel] = useState(d.label);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftLabel(d.label), [d.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitLabel = useCallback(() => {
    if (draftLabel === d.label) {
      setEditing(false);
      return;
    }
    updateDiagram((draft) => {
      const list = (draft.groups as Array<Record<string, unknown>> | undefined) ?? [];
      const idx = list.findIndex((g) => (g as { id?: string }).id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], label: draftLabel };
        draft.groups = list;
      }
    });
    setEditing(false);
  }, [draftLabel, d.label, id, updateDiagram]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateDiagram((draft) => {
        const list = (draft.groups as Array<Record<string, unknown>> | undefined) ?? [];
        draft.groups = list.filter((g) => (g as { id?: string }).id !== id);
      });
    },
    [id, updateDiagram],
  );

  return (
    <div
      className={`group/note relative h-full min-h-0 w-full min-w-0 rounded-lg border-2 border-dashed ${palette} transition-shadow duration-150 ${
        selected ? 'shadow-lg ring-2 ring-action ring-offset-1' : 'shadow-sm'
      }`}
    >
      <NodeResizer
        minWidth={200}
        minHeight={120}
        maxWidth={2000}
        maxHeight={1500}
        isVisible={selected ?? false}
        lineClassName="!border-action/40"
        handleClassName="!w-2.5 !h-2.5 !rounded-sm !border !border-action !bg-surface"
      />

      {/* Label chip — top-left, tag-style */}
      <div className="absolute -top-3 left-3 z-10 flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-0.5 shadow-sm">
        {editing ? (
          <input
            ref={inputRef}
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLabel();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraftLabel(d.label);
                setEditing(false);
              }
            }}
            className="nodrag nopan w-32 bg-transparent text-[11px] font-semibold outline-none"
            placeholder="Group label"
          />
        ) : (
          <span
            className={`cursor-text text-[11px] font-semibold ${labelText}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {d.label || 'Untitled group'}
          </span>
        )}
      </div>

      {/* Hover toolbar — Rename + Delete, top-right of the container.
       * Same opacity-fade pattern as state nodes' quick toolbar. */}
      <div className="nodrag nopan pointer-events-none absolute -top-3 right-3 flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/note:pointer-events-auto group-hover/note:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Rename group"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive-foreground cursor-pointer"
          aria-label="Delete group"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});
