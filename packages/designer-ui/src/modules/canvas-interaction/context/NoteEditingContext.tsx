import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Cross-component channel for "which sticky note is currently in
 * edit mode". The edit-mode trigger lives in FlowCanvas (so it can
 * be wired to React Flow's `onNodeDoubleClick` callback, which is
 * the only reliable way to react to a true double-click without
 * fighting React Flow's selection state machine). The NoteNode
 * components READ this state to decide whether to render their
 * textarea instead of the display div.
 *
 * Why a context instead of local state on the NoteNode:
 * - Putting `onDoubleClick={() => setEditing(true)}` on the
 *   NoteNode's wrapper div meant the second click of a
 *   double-click sometimes deselected the node (React Flow read
 *   the second click as a separate "click selected node again"
 *   event and toggled it off). The user reported the side panel
 *   flickering open/closed and the textarea never gaining focus.
 * - Routing the trigger through React Flow's high-level
 *   `onNodeDoubleClick` lets React Flow finish its own
 *   selection-state book-keeping first, then we update the edit
 *   flag here. The toolbar / inspector stay stable.
 */
interface NoteEditingContextValue {
  /** Id of the note currently being edited, or `null` if none. */
  editingNoteId: string | null;
  /** Set the editing target. Pass `null` to leave edit mode. */
  setEditingNoteId: (id: string | null) => void;
}

const NoteEditingContext = createContext<NoteEditingContextValue>({
  editingNoteId: null,
  setEditingNoteId: () => {},
});

export function NoteEditingProvider({ children }: { children: ReactNode }) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ editingNoteId, setEditingNoteId }),
    [editingNoteId],
  );
  return (
    <NoteEditingContext.Provider value={value}>
      {children}
    </NoteEditingContext.Provider>
  );
}

export function useNoteEditing(): NoteEditingContextValue {
  return useContext(NoteEditingContext);
}
