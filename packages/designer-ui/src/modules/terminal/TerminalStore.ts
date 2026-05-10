import { create } from 'zustand';

import type { TerminalSession } from './TerminalTypes.js';

/**
 * UI state for the integrated terminal panel.
 *
 * One store handles three concerns that travel together:
 *  - **panel chrome** (open / closed, height in px)
 *  - **session list** (an ordered set of `TerminalSession`)
 *  - **active tab** (which session's `TerminalView` is visible)
 *
 * The store does NOT own the WebSocket / xterm instance — those live in
 * the per-session `TerminalView` component. The store is purely metadata
 * the panel renders from. This keeps the store JSON-serializable so a
 * future `WorkspaceSession` schema bump can persist it as-is.
 */

const DEFAULT_HEIGHT_PX = 260;
const MIN_HEIGHT_PX = 120;
const MAX_HEIGHT_PX = 800;

interface TerminalStoreState {
  /** Panel chrome */
  isOpen: boolean;
  heightPx: number;

  /** Session list */
  sessions: TerminalSession[];
  activeId: string | null;

  /** Actions: chrome */
  open(): void;
  close(): void;
  toggle(): void;
  setHeight(px: number): void;

  /** Actions: sessions */
  createSession(input: { cwd: string; shell?: string; name?: string }): TerminalSession;
  removeSession(id: string): void;
  renameSession(id: string, name: string): void;
  setActive(id: string): void;

  /** Actions: per-session lifecycle (called from TerminalView) */
  markStarting(id: string): void;
  markRunning(id: string, pid: number, info?: { shell?: string; cwd?: string }): void;
  markExited(id: string, exitCode: number): void;
  markError(id: string, error: string): void;
}

let nextSessionCounter = 1;

function clampHeight(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_HEIGHT_PX;
  return Math.max(MIN_HEIGHT_PX, Math.min(MAX_HEIGHT_PX, Math.round(px)));
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  isOpen: false,
  heightPx: DEFAULT_HEIGHT_PX,
  sessions: [],
  activeId: null,

  open() {
    set({ isOpen: true });
    if (get().sessions.length === 0) return; // panel decides whether to auto-create
  },
  close() {
    set({ isOpen: false });
  },
  toggle() {
    set((s) => ({ isOpen: !s.isOpen }));
  },
  setHeight(px) {
    set({ heightPx: clampHeight(px) });
  },

  createSession({ cwd, shell, name }) {
    const id = `term-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const session: TerminalSession = {
      id,
      name: name?.trim() || `Terminal ${nextSessionCounter++}`,
      cwd,
      ...(shell ? { shell } : {}),
      state: 'connecting',
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      sessions: [...s.sessions, session],
      activeId: id,
      isOpen: true,
    }));
    return session;
  },

  removeSession(id) {
    set((s) => {
      const next = s.sessions.filter((t) => t.id !== id);
      let activeId = s.activeId;
      if (activeId === id) {
        // Pick neighbor: try the next-right tab, fall back to last.
        const idx = s.sessions.findIndex((t) => t.id === id);
        activeId = next[idx]?.id ?? next[next.length - 1]?.id ?? null;
      }
      return { sessions: next, activeId };
    });
  },

  renameSession(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      sessions: s.sessions.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
    }));
  },

  setActive(id) {
    set({ activeId: id });
  },

  markStarting(id) {
    set((s) => ({
      sessions: s.sessions.map((t) => (t.id === id ? { ...t, state: 'starting' } : t)),
    }));
  },
  markRunning(id, pid, info) {
    set((s) => ({
      sessions: s.sessions.map((t) =>
        t.id === id
          ? {
              ...t,
              state: 'running',
              pid,
              ...(info?.shell ? { shell: info.shell } : {}),
              ...(info?.cwd ? { cwd: info.cwd } : {}),
            }
          : t,
      ),
    }));
  },
  markExited(id, exitCode) {
    set((s) => ({
      sessions: s.sessions.map((t) =>
        t.id === id ? { ...t, state: 'exited', exitCode } : t,
      ),
    }));
  },
  markError(id, error) {
    set((s) => ({
      sessions: s.sessions.map((t) =>
        t.id === id ? { ...t, state: 'error', error } : t,
      ),
    }));
  },
}));

/** Constants exported for the resize handle / panel layout to share bounds. */
export const TERMINAL_PANEL_BOUNDS = {
  defaultPx: DEFAULT_HEIGHT_PX,
  minPx: MIN_HEIGHT_PX,
  maxPx: MAX_HEIGHT_PX,
};
