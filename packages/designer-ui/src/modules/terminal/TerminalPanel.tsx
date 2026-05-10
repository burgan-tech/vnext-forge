import { useCallback, useEffect } from 'react';

import { useTerminalStore, TERMINAL_PANEL_BOUNDS } from './TerminalStore.js';
import { TerminalTabs } from './TerminalTabs.js';
import { TerminalView } from './TerminalView.js';

export interface TerminalPanelProps {
  /** Default cwd for new terminals (resolved from active project). */
  defaultCwd: string | null;
  /** API base URL the WS should connect through (apps/web dev mode only). */
  apiBaseUrl?: string;
  /**
   * Optional shell override forwarded to every new tab. Leave undefined
   * to let the host pick `process.env.SHELL`.
   */
  defaultShell?: string;
}

/**
 * Bottom-of-screen integrated terminal panel. Renders only when the store
 * says the panel is open and there's a valid cwd to seed new tabs from.
 *
 * Auto-creates the first terminal when the panel opens for the first time;
 * subsequent opens reuse whichever tabs the user left around.
 *
 * Sessions stay mounted across tab switches via `TerminalView`'s `display`
 * toggle, so users don't lose scrollback when they Cmd+Click between tabs.
 */
export function TerminalPanel({ defaultCwd, apiBaseUrl, defaultShell }: TerminalPanelProps) {
  const isOpen = useTerminalStore((s) => s.isOpen);
  const heightPx = useTerminalStore((s) => s.heightPx);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);

  const createSession = useTerminalStore((s) => s.createSession);
  const removeSession = useTerminalStore((s) => s.removeSession);
  const close = useTerminalStore((s) => s.close);

  const handleNew = useCallback(() => {
    if (!defaultCwd) return;
    createSession({ cwd: defaultCwd, ...(defaultShell ? { shell: defaultShell } : {}) });
  }, [defaultCwd, defaultShell, createSession]);

  // First-open auto-create: when the panel opens with no sessions, spawn one.
  useEffect(() => {
    if (!isOpen) return;
    if (sessions.length > 0) return;
    if (!defaultCwd) return;
    createSession({ cwd: defaultCwd, ...(defaultShell ? { shell: defaultShell } : {}) });
  }, [isOpen, sessions.length, defaultCwd, defaultShell, createSession]);

  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Integrated Terminal"
      className="bg-background relative flex shrink-0 flex-col border-t border-zinc-800/60"
      style={{
        height: `${heightPx}px`,
        minHeight: `${TERMINAL_PANEL_BOUNDS.minPx}px`,
        maxHeight: `${TERMINAL_PANEL_BOUNDS.maxPx}px`,
      }}>
      <ResizeHandle />
      <TerminalTabs
        onNewTerminal={handleNew}
        onCloseTerminal={(id) => removeSession(id)}
        onClosePanel={close}
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="text-foreground/60 flex h-full w-full items-center justify-center text-sm">
            {defaultCwd ? 'Starting terminal…' : 'Open a project to use the terminal.'}
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="absolute inset-0">
              <TerminalView
                session={session}
                isActive={session.id === activeId}
                apiBaseUrl={apiBaseUrl}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Drag handle along the panel's top edge. Sets cursor + listens for pointer
 * drag, translating delta-y into `setHeight(px)`. Goes through pointer events
 * (not the shared ResizablePanel) because the terminal docks below the
 * existing horizontal split and we want the drag to grow the panel UPWARD —
 * a separate idiom from the rest of the shell's panes.
 */
function ResizeHandle() {
  const heightPx = useTerminalStore((s) => s.heightPx);
  const setHeight = useTerminalStore((s) => s.setHeight);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize Terminal Panel"
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = heightPx;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        function onMove(ev: PointerEvent) {
          const delta = startY - ev.clientY; // dragging up grows the panel
          setHeight(startHeight + delta);
        }
        function onUp(ev: PointerEvent) {
          target.releasePointerCapture(ev.pointerId);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHeight(heightPx + 16);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHeight(heightPx - 16);
        }
      }}
      className="absolute -top-1 left-0 right-0 z-10 h-2 cursor-row-resize hover:bg-emerald-500/30"
    />
  );
}
