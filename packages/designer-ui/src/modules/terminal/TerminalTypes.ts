/**
 * Public types for the integrated terminal module.
 *
 * Local to designer-ui (no services-core import) — same convention as
 * QuickSwitcher / Snippets / Sessions modules.
 */

export type TerminalConnectionState =
  | 'idle'
  | 'connecting'
  | 'starting'
  | 'running'
  | 'exited'
  | 'error';

export interface TerminalSession {
  /** Stable client-side id; also used as the WS `session` query param. */
  id: string;
  /** Human-readable label (auto: "Terminal 1", user can rename later). */
  name: string;
  /** Spawn cwd; the panel resolves this from the active projectId at create-time. */
  cwd: string;
  /** Optional shell override; otherwise the host picks `process.env.SHELL`. */
  shell?: string;
  /** Connection lifecycle (renderer-side mirror of pty state). */
  state: TerminalConnectionState;
  /** Process id once the host has spawned the pty. */
  pid?: number;
  /** Last error message when `state === 'error'`. */
  error?: string;
  /** Exit code surfaced to the user when the shell terminates on its own. */
  exitCode?: number;
  /** ISO timestamp the tab was created. */
  createdAt: string;
}

export interface TerminalSocketStartOptions {
  cwd: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface TerminalSocketEvents {
  onReady?: (info: { pid: number; shell: string; cwd: string; cols: number; rows: number }) => void;
  onData?: (chunk: string) => void;
  onExit?: (info: { code: number; signal: number | null }) => void;
  onError?: (info: { code: string; message: string }) => void;
  onClose?: () => void;
}
