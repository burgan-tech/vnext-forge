import { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

import '@xterm/xterm/css/xterm.css';

import { TerminalSocket, buildTerminalWsUrl } from './TerminalSocket.js';
import { useTerminalStore } from './TerminalStore.js';
import type { TerminalSession } from './TerminalTypes.js';

interface TerminalViewProps {
  session: TerminalSession;
  /** Whether this view is the active tab — drives `display`. */
  isActive: boolean;
  /** Optional API base URL the WS should connect through (apps/web dev mode). */
  apiBaseUrl?: string;
}

/**
 * Single terminal tab — owns its xterm.js instance and the matching pty
 * WebSocket. Stays mounted across tab switches (visibility toggled via
 * `display`) so scrollback survives a switch-away-and-back.
 *
 * Lifecycle:
 *  1. Mount → create xterm + addons, open WebSocket, send `start`.
 *  2. xterm.onData ↔ socket.write — keystrokes flow to pty.
 *  3. socket onData → xterm.write — pty output streams to renderer.
 *  4. ResizeObserver → fit addon + socket.resize — keeps cols/rows in sync.
 *  5. Unmount (panel close OR session removed) → dispose both.
 *
 * The "isActive" flag drives `display: block | none`. We deliberately keep
 * the underlying xterm DOM alive so users don't lose scrollback when they
 * Cmd+Click between tabs.
 */
export function TerminalView({ session, isActive, apiBaseUrl }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Per-session refs survive across renders without re-creating xterm.
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<TerminalSocket | null>(null);
  const sessionIdRef = useRef<string>(session.id);

  // Bring store actions into the effect with stable refs (Zustand selectors
  // re-render on changes; we only need the actions). Using getState() avoids
  // adding a re-render trigger every time `state` ticks.
  const store = useTerminalStore;

  // ── mount xterm + open socket (one-time per session id) ──────────────────
  useEffect(() => {
    sessionIdRef.current = session.id;
    if (!containerRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5_000,
      allowProposedApi: true,
      theme: {
        background: '#0b1020',
        foreground: '#dde2f0',
        cursor: '#dde2f0',
        cursorAccent: '#0b1020',
        selectionBackground: '#3b4a78',
        black: '#1c1f2b',
        red: '#ff6b81',
        green: '#48c78e',
        yellow: '#ffd166',
        blue: '#8aa9ff',
        magenta: '#c79bff',
        cyan: '#5fd6ce',
        white: '#dde2f0',
        brightBlack: '#3b4156',
        brightRed: '#ff8da0',
        brightGreen: '#79e3ad',
        brightYellow: '#ffe07a',
        brightBlue: '#a4bcff',
        brightMagenta: '#dab9ff',
        brightCyan: '#82e6e0',
        brightWhite: '#ffffff',
      },
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;

    // First fit may run with 0×0 dims if the panel just opened — guard with a
    // microtask.
    queueMicrotask(() => {
      try {
        fit.fit();
      } catch {
        /* ignore — ResizeObserver below will retry */
      }
    });

    const url = buildTerminalWsUrl(apiBaseUrl, session.id);
    const socket = new TerminalSocket({
      url,
      // Resolve cols/rows at WS-open time, not now. The microtask above
      // calls `fit()` which mutates `term.cols`/`term.rows` after this
      // closure is created — capturing them here would lock the pty to
      // 80×24 defaults and any typed line would wrap incorrectly.
      buildStart: () => ({
        cwd: session.cwd,
        ...(session.shell ? { shell: session.shell } : {}),
        cols: term.cols,
        rows: term.rows,
      }),
      events: {
        onReady: ({ pid, shell, cwd }) => {
          store.getState().markRunning(session.id, pid, { shell, cwd });
        },
        onData: (chunk) => {
          term.write(chunk);
        },
        onExit: ({ code }) => {
          store.getState().markExited(session.id, code);
          term.write(`\r\n\x1b[2m[process exited: ${code}]\x1b[0m\r\n`);
        },
        onError: ({ code, message }) => {
          store.getState().markError(session.id, `${code}: ${message}`);
          term.write(`\r\n\x1b[31m[pty error: ${code} — ${message}]\x1b[0m\r\n`);
        },
        onClose: () => {
          // No state change — exit/error already moved us out of running.
        },
      },
    });
    store.getState().markStarting(session.id);
    socket.connect();
    socketRef.current = socket;

    // Forward keystrokes.
    const keystrokeSub = term.onData((data) => {
      socket.write(data);
    });

    // Forward viewport changes.
    const resizeSub = term.onResize(({ cols, rows }) => {
      socket.resize(cols, rows);
    });

    // Re-fit whenever the container size changes (panel resize, tab switch
    // in, window resize).
    const observer = new ResizeObserver(() => {
      if (!fitRef.current) return;
      try {
        fitRef.current.fit();
      } catch {
        /* ignored */
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      keystrokeSub.dispose();
      resizeSub.dispose();
      socket.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      socketRef.current = null;
    };
    // session.id changing means a different tab — re-create. Other props
    // are intentionally NOT in the deps; re-creating xterm on cwd/shell
    // change would lose scrollback and feel buggy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // ── refit + focus when this tab becomes active ──────────────────────────
  useEffect(() => {
    if (!isActive) return;
    queueMicrotask(() => {
      try {
        fitRef.current?.fit();
        termRef.current?.focus();
      } catch {
        /* ignore */
      }
    });
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        display: isActive ? 'block' : 'none',
        backgroundColor: '#0b1020',
      }}
      data-terminal-session-id={session.id}
    />
  );
}
