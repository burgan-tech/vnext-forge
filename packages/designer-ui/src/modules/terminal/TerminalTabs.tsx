import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useTerminalStore } from './TerminalStore.js';
import type { TerminalSession } from './TerminalTypes.js';

interface TerminalTabsProps {
  onNewTerminal: () => void;
  onCloseTerminal: (id: string) => void;
  onClosePanel: () => void;
}

function tabAccent(state: TerminalSession['state']): string {
  switch (state) {
    case 'running':
      return 'bg-emerald-500';
    case 'starting':
    case 'connecting':
      return 'bg-amber-400';
    case 'exited':
      return 'bg-zinc-500';
    case 'error':
      return 'bg-rose-500';
    default:
      return 'bg-zinc-500';
  }
}

/**
 * Tab bar across the top of the terminal panel: list of open sessions,
 * `+` to create a new one, `×` per tab to close, `▾` to collapse the panel.
 *
 * Renaming: double-click on a tab label flips it to an inline `<input>`;
 * Enter / blur commits, Esc cancels.
 */
export function TerminalTabs({ onNewTerminal, onCloseTerminal, onClosePanel }: TerminalTabsProps) {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const setActive = useTerminalStore((s) => s.setActive);
  const renameSession = useTerminalStore((s) => s.renameSession);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startEdit(session: TerminalSession) {
    setEditingId(session.id);
    setDraftName(session.name);
  }
  function commitEdit() {
    if (editingId) renameSession(editingId, draftName);
    setEditingId(null);
    setDraftName('');
  }
  function cancelEdit() {
    setEditingId(null);
    setDraftName('');
  }

  return (
    <div className="bg-surface/80 flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b border-zinc-800/50 backdrop-blur-sm">
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        const isEditing = editingId === session.id;
        return (
          <div
            key={session.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => setActive(session.id)}
            onDoubleClick={() => startEdit(session)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(session.id);
              }
            }}
            className={
              'group flex min-w-[140px] cursor-pointer items-center gap-2 px-3 text-xs ' +
              (isActive
                ? 'bg-background/70 text-foreground border-t-2 border-t-emerald-400'
                : 'text-foreground/70 hover:text-foreground hover:bg-background/40 border-t-2 border-transparent')
            }>
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${tabAccent(session.state)}`}
            />
            {isEditing ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                  }
                  e.stopPropagation();
                }}
                className="bg-background/60 text-foreground rounded px-1 py-0.5 text-xs focus:outline-none"
              />
            ) : (
              <span className="truncate" title={`${session.name} — ${session.cwd}`}>
                {session.name}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTerminal(session.id);
              }}
              aria-label={`Close ${session.name}`}
              className="text-foreground/40 hover:text-foreground/90 ml-auto rounded p-0.5 opacity-0 group-hover:opacity-100">
              <X size={12} />
            </button>
          </div>
        );
      })}
      <div className="ml-auto flex shrink-0 items-center gap-1 pr-2">
        <button
          type="button"
          onClick={onNewTerminal}
          aria-label="New Terminal"
          className="text-foreground/70 hover:text-foreground hover:bg-background/40 rounded p-1.5">
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={onClosePanel}
          aria-label="Hide Terminal Panel"
          className="text-foreground/70 hover:text-foreground hover:bg-background/40 rounded px-2 py-1 text-xs">
          ▾
        </button>
      </div>
    </div>
  );
}
