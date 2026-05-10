import type { TerminalSocketEvents, TerminalSocketStartOptions } from './TerminalTypes.js';

/**
 * Build the `/api/pty` WebSocket URL. Mirrors the LSP client's URL helper
 * (`packages/designer-ui/src/modules/code-editor/editor/lspClient.ts`):
 *  - prefer an explicit `apiBaseUrl` (apps/web dev mode points at :3001)
 *  - fall back to `window.location.host` (Electron same-origin)
 */
export function buildTerminalWsUrl(apiBaseUrl: string | undefined, sessionId: string): string {
  const params = `session=${encodeURIComponent(sessionId)}`;
  if (apiBaseUrl) {
    try {
      const url = new URL(apiBaseUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/api/pty?${params}`;
    } catch {
      // fall through to window.location
    }
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/pty?${params}`;
  }
  // Last-resort default; tests that build URLs without window will see this.
  return `ws://127.0.0.1/api/pty?${params}`;
}

/**
 * Renderer-side wrapper around the pty WebSocket. Speaks the JSON protocol
 * defined in `apps/server/src/pty/pty-protocol.ts` and forwards parsed
 * frames to the supplied callbacks.
 *
 * Lifecycle:
 *  1. `connect()` opens the WS.
 *  2. On open, the wrapper sends a `start` frame with cwd / shell / cols / rows.
 *  3. The host replies with `ready` (or `error`); from there `data` frames
 *     stream in until the user closes (or the shell exits).
 *  4. `dispose()` closes the WS — the host kills the pty in response.
 */
export class TerminalSocket {
  private readonly url: string;
  private readonly buildStart: () => TerminalSocketStartOptions;
  private readonly events: TerminalSocketEvents;
  private ws: WebSocket | null = null;
  private disposed = false;
  /**
   * Latest resize requested before the WS opened. We replay it as a
   * `resize` frame right after `start` once the connection lands, so the
   * pty's initial dimensions match what xterm settled on after `fit()` —
   * not the 80×24 defaults captured at component-mount time. Without
   * this, the first typed line after launch wraps at column 80 even
   * though xterm renders at 200+ columns.
   */
  private pendingResize: { cols: number; rows: number } | null = null;
  private opened = false;

  constructor(args: {
    url: string;
    /** Called at WS-open time so cols/rows reflect the latest fit, not construction-time defaults. */
    buildStart: () => TerminalSocketStartOptions;
    events: TerminalSocketEvents;
  }) {
    this.url = args.url;
    this.buildStart = args.buildStart;
    this.events = args.events;
  }

  connect(): void {
    if (this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.opened = true;
      const start = this.buildStart();
      this.send({
        type: 'start',
        cwd: start.cwd,
        ...(start.shell ? { shell: start.shell } : {}),
        ...(typeof start.cols === 'number' ? { cols: start.cols } : {}),
        ...(typeof start.rows === 'number' ? { rows: start.rows } : {}),
        ...(start.env ? { env: start.env } : {}),
      });
      // Replay any size that arrived between connect() and open(). Cheap
      // belt-and-braces against the initial fit() landing one tick after
      // the socket was constructed.
      if (this.pendingResize) {
        const { cols, rows } = this.pendingResize;
        this.pendingResize = null;
        if (cols !== start.cols || rows !== start.rows) {
          this.send({ type: 'resize', cols, rows });
        }
      }
    });

    ws.addEventListener('message', (ev) => {
      // Server only sends text frames in this protocol; binary would be a bug.
      if (typeof ev.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return;
      const msg = parsed as { type: string; [key: string]: unknown };
      switch (msg.type) {
        case 'ready':
          this.events.onReady?.({
            pid: Number(msg.pid),
            shell: String(msg.shell ?? ''),
            cwd: String(msg.cwd ?? ''),
            cols: Number(msg.cols ?? 80),
            rows: Number(msg.rows ?? 24),
          });
          return;
        case 'data':
          if (typeof msg.chunk === 'string') this.events.onData?.(msg.chunk);
          return;
        case 'exit':
          this.events.onExit?.({
            code: Number(msg.code ?? 0),
            signal: msg.signal == null ? null : Number(msg.signal),
          });
          return;
        case 'error':
          this.events.onError?.({
            code: String(msg.code ?? 'PTY_ERROR'),
            message: String(msg.message ?? 'pty error'),
          });
          return;
        default:
          return;
      }
    });

    ws.addEventListener('close', () => {
      this.events.onClose?.();
    });
  }

  /** Send a keystroke to the pty. */
  write(data: string): void {
    this.send({ type: 'input', data });
  }

  /** Inform the pty about the new viewport. */
  resize(cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) return;
    if (!this.opened) {
      // Buffer the latest size; the open handler replays it.
      this.pendingResize = { cols, rows };
      return;
    }
    this.send({ type: 'resize', cols, rows });
  }

  /** Send a POSIX signal (Ctrl+C, etc.). Most users hit ^C in the terminal directly; this is for explicit "kill". */
  signal(signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGHUP'): void {
    this.send({ type: 'signal', signal });
  }

  /** Best-effort liveness check; not used by the panel today. */
  ping(): void {
    this.send({ type: 'ping' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ws) {
      try {
        this.ws.close(1000, 'client dispose');
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private send(msg: unknown): void {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      /* socket may be closing */
    }
  }
}
