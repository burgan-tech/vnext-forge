import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { Trash2, Type } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { useNoteEditing } from '../../context/NoteEditingContext';

type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';

interface NoteData {
  text: string;
  color?: NoteColor;
  /** Numeric font size in px, 8..48 typical range. */
  fontSize?: number;
  /** Optional override for text color (hex string). */
  textColor?: string;
  [key: string]: unknown;
}

/**
 * Tailwind palette per background-color key. Each entry handles
 * both light and dark themes. The default text color is part of
 * the palette so the note reads cleanly without an explicit
 * `textColor` — but the user can override it via the toolbar.
 */
const COLOR_CLASSES: Record<NoteColor, string> = {
  yellow:
    'bg-amber-100 border-amber-200/80 text-amber-900 dark:bg-amber-200/15 dark:border-amber-300/30 dark:text-amber-100',
  blue:
    'bg-sky-100 border-sky-200/80 text-sky-900 dark:bg-sky-300/15 dark:border-sky-300/30 dark:text-sky-100',
  green:
    'bg-emerald-100 border-emerald-200/80 text-emerald-900 dark:bg-emerald-300/15 dark:border-emerald-300/30 dark:text-emerald-100',
  pink:
    'bg-pink-100 border-pink-200/80 text-pink-900 dark:bg-pink-300/15 dark:border-pink-300/30 dark:text-pink-100',
};

/** Background swatch (full opacity) for toolbar buttons. */
const SWATCH_CLASSES: Record<NoteColor, string> = {
  yellow: 'bg-amber-300',
  blue: 'bg-sky-300',
  green: 'bg-emerald-300',
  pink: 'bg-pink-300',
};

const DEFAULT_FONT_PX = 13;
const FONT_MIN = 8;
const FONT_MAX = 96;

/**
 * Sticky note rendered as a custom React Flow node. Selected
 * state shows a floating toolbar below the note with controls
 * for background color, text color, font size, and delete.
 *
 * Font size is a *number* (not a preset) so users aren't locked
 * to S/M/L. Text color is a free-form hex via the browser's
 * native color picker, with a "reset to palette default"
 * button for quick revert.
 */
export const NoteNode = memo(function NoteNode({ id, data, selected }: NodeProps) {
  const d = data as NoteData;
  const colorKey: NoteColor = d.color ?? 'yellow';
  const fontPx = typeof d.fontSize === 'number' ? d.fontSize : DEFAULT_FONT_PX;
  const palette = COLOR_CLASSES[colorKey];

  const updateDiagram = useWorkflowStore((s) => s.updateDiagram);
  const [draftText, setDraftText] = useState(d.text);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Edit mode is now driven by the NoteEditingContext (set from
  // FlowCanvas's `onNodeDoubleClick`), not by a wrapper-div
  // `onDoubleClick` handler. See `NoteEditingContext.tsx` for why
  // that change was necessary.
  const { editingNoteId, setEditingNoteId } = useNoteEditing();
  const editing = editingNoteId === id;
  const exitEditing = useCallback(() => setEditingNoteId(null), [setEditingNoteId]);

  // Local draft state for the font-size number input. Without
  // this, every keystroke would parse `Number(value)` and clamp
  // — clearing the field made `Number('')` resolve to 0, which
  // clamped immediately back to `FONT_MIN` (8). Users couldn't
  // erase the value to type a new one from scratch. We hold a
  // string draft, let the user type freely (including empty),
  // and only commit a real number on blur or Enter.
  const [draftFontPx, setDraftFontPx] = useState<string>(String(d.fontSize ?? DEFAULT_FONT_PX));

  useEffect(() => setDraftText(d.text), [d.text]);
  useEffect(() => {
    setDraftFontPx(String(d.fontSize ?? DEFAULT_FONT_PX));
  }, [d.fontSize]);

  useEffect(() => {
    if (editing) {
      taRef.current?.focus();
      taRef.current?.select();
    }
  }, [editing]);

  const commitText = useCallback(() => {
    if (draftText === d.text) {
      exitEditing();
      return;
    }
    updateDiagram((draft) => {
      const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
      const idx = list.findIndex((n) => (n as { id?: string }).id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], text: draftText };
        draft.notes = list;
      }
    });
    exitEditing();
  }, [draftText, d.text, id, updateDiagram, exitEditing]);

  // Shallow patch helper. Used by every toolbar control.
  const patchNote = useCallback(
    (patch: Record<string, unknown>) => {
      updateDiagram((draft) => {
        const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
        const idx = list.findIndex((n) => (n as { id?: string }).id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...patch };
          draft.notes = list;
        }
      });
    },
    [id, updateDiagram],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateDiagram((draft) => {
        const list = (draft.notes as Array<Record<string, unknown>> | undefined) ?? [];
        draft.notes = list.filter((n) => (n as { id?: string }).id !== id);
      });
    },
    [id, updateDiagram],
  );

  // Inline style for the text — applies the chosen font size and
  // (optionally) text color override. When `textColor` is set we
  // skip the palette's text-color Tailwind class via `color`
  // taking precedence (inline style wins over CSS class).
  const textStyle: React.CSSProperties = {
    fontSize: `${fontPx}px`,
    ...(d.textColor ? { color: d.textColor } : {}),
  };

  return (
    <div
      className={`group relative h-full min-h-0 w-full min-w-0 rounded-md border ${palette} shadow-sm transition-all duration-150 ${
        selected ? 'ring-2 ring-action ring-offset-1 shadow-md' : ''
      }`}
      // No local onDoubleClick here — the trigger is now wired
      // through React Flow's `onNodeDoubleClick` callback in
      // FlowCanvas, which lives outside React Flow's selection
      // pipeline and never gets misinterpreted as two toggling
      // single clicks.
    >
      <NodeResizer
        minWidth={120}
        minHeight={60}
        maxWidth={1200}
        maxHeight={800}
        isVisible={selected ?? false}
        lineClassName="!border-action/40"
        handleClassName="!w-2.5 !h-2.5 !rounded-sm !border !border-action !bg-surface"
      />

      {editing ? (
        <textarea
          ref={taRef}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            // CRITICAL: stop the keydown from bubbling to React
            // Flow's global keyboard handler. Without this,
            // pressing Backspace or Delete *inside the textarea*
            // triggers React Flow's `deleteKeyCode={['Backspace',
            // 'Delete']}` handler — which deletes the SELECTED
            // NOTE rather than removing characters from the text.
            // The textarea's own default Backspace/Delete behavior
            // still works because we don't `preventDefault` here.
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraftText(d.text);
              exitEditing();
            }
          }}
          style={textStyle}
          className="nodrag nopan h-full w-full resize-none rounded-md bg-transparent p-3 leading-relaxed outline-none"
          placeholder="Type a note…"
        />
      ) : (
        <div
          style={textStyle}
          className="h-full w-full overflow-hidden whitespace-pre-wrap break-words p-3 leading-relaxed"
          aria-label={d.text || 'Empty note'}
        >
          {d.text || <span className="italic opacity-60">Double-click to edit</span>}
        </div>
      )}

      {/*
       * Floating toolbar — appears BELOW the note when selected.
       * Wrapped in React Flow's `NodeToolbar` (not a plain
       * `absolute` div) so the bar is portaled into React Flow's
       * dedicated toolbar layer. Clicks on the toolbar are
       * tracked as node interactions instead of pane clicks, so
       * the input / color picker / spinners no longer
       * accidentally deselect the note while the user fiddles
       * with them.
       *
       * Sections, left → right:
       *   1. Background color swatches (4 presets)
       *   2. Text color (native `<input type="color">` + reset)
       *   3. Font size (number input)
       *   4. Delete
       */}
      <NodeToolbar
        isVisible={Boolean(selected) && !editing}
        position={Position.Bottom}
        offset={10}
        // Stop click + mousedown from reaching the React Flow
        // pane handler. Without these, clicks inside the toolbar
        // can be misread as pane clicks (which my onPaneClick
        // uses to clear selection) and the toolbar would close
        // the moment you touch any of its controls.
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="nodrag nopan flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-1 shadow-md"
      >
        {/* Background color presets */}
        <div className="flex items-center gap-0.5 pr-1.5 border-r border-border">
          {(['yellow', 'blue', 'green', 'pink'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                patchNote({ color: c });
              }}
              className={`size-4 rounded-full transition-transform hover:scale-110 ${SWATCH_CLASSES[c]} ${
                colorKey === c ? 'ring-2 ring-action ring-offset-1' : ''
              }`}
              aria-label={`Set note background to ${c}`}
              title={c}
            />
          ))}
        </div>

        {/* Text color — native picker + reset */}
        <label
          className="flex cursor-pointer items-center gap-1 pr-1.5 border-r border-border"
          title="Text color"
        >
          <span className="text-[11px] font-semibold text-muted-foreground">A</span>
          <input
            type="color"
            value={d.textColor ?? '#000000'}
            onChange={(e) => {
              e.stopPropagation();
              patchNote({ textColor: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="size-4 cursor-pointer rounded border border-border bg-transparent p-0"
            aria-label="Text color picker"
          />
          {d.textColor && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                patchNote({ textColor: undefined });
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
              aria-label="Reset text color"
              title="Reset to default"
            >
              ✕
            </button>
          )}
        </label>

        {/* Font size — free-form number.
          *
          * Uses a local string draft so the user can fully clear
          * the field and retype from scratch. Per-keystroke we
          * only update the local draft; the real value commits
          * on blur or Enter. If the user leaves the field empty
          * or invalid, the draft snaps back to the previous good
          * value. Escape cancels the edit.
          */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-border">
          <Type size={11} className="text-muted-foreground" />
          <input
            type="number"
            min={FONT_MIN}
            max={FONT_MAX}
            value={draftFontPx}
            onChange={(e) => {
              e.stopPropagation();
              // Per-keystroke: always update the local draft so
              // the user can blank the field and retype freely.
              // If the current value parses to a valid in-range
              // integer, ALSO commit it live — so the spinner
              // arrows and direct typing show the new font size
              // immediately. Empty / partial / out-of-range
              // values stay as drafts; the final clamp happens
              // on blur via the handler below.
              const text = e.target.value;
              setDraftFontPx(text);
              if (text.trim() === '') return;
              const raw = Number(text);
              if (!Number.isFinite(raw)) return;
              if (raw < FONT_MIN || raw > FONT_MAX) return;
              const rounded = Math.round(raw);
              if (rounded !== fontPx) patchNote({ fontSize: rounded });
            }}
            onBlur={(e) => {
              e.stopPropagation();
              const raw = Number(draftFontPx);
              if (!Number.isFinite(raw) || draftFontPx.trim() === '') {
                setDraftFontPx(String(fontPx));
                return;
              }
              const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(raw)));
              if (clamped !== fontPx) patchNote({ fontSize: clamped });
              setDraftFontPx(String(clamped));
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraftFontPx(String(fontPx));
                e.currentTarget.blur();
              }
            }}
            className="w-12 rounded border border-border bg-surface px-1 py-0.5 text-center text-[10px] font-mono text-foreground outline-none focus:border-action"
            aria-label={`Font size in pixels (${FONT_MIN}–${FONT_MAX})`}
            title="Font size (px) — Enter to apply"
          />
          <span className="text-[9px] text-muted-foreground">px</span>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive-foreground cursor-pointer"
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash2 size={12} />
        </button>
      </NodeToolbar>
    </div>
  );
});
