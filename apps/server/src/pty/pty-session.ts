import { spawn as spawnPty, type IPty } from 'node-pty';
import os from 'node:os';
import path from 'node:path';
import type { RawData, WebSocket } from 'ws';

import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

import { assertPtyInboundMessageSizeOk } from './pty-ws-policy.js';
import {
  ptyClientMessageSchema,
  type PtyClientStart,
  type PtyServerMessage,
} from './pty-protocol.js';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_TERM_NAME = 'xterm-256color';

/**
 * Resolve the user's preferred shell when the client doesn't override it.
 *
 * Honors `SHELL` on POSIX (login users almost always have it set) and
 * `COMSPEC` on Windows; falls back to `/bin/sh` and `cmd.exe` respectively
 * so a launch never fails just because the user has an unusual environment.
 */
function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'cmd.exe';
  }
  return process.env.SHELL ?? '/bin/sh';
}

function rawDataByteLength(data: RawData): number {
  if (typeof data === 'string') return Buffer.byteLength(data);
  if (Buffer.isBuffer(data)) return data.byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
}

function rawDataToString(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
  return Buffer.concat(data).toString('utf-8');
}

export interface PtySessionOptions {
  ws: WebSocket;
  sessionId: string;
  logger: LoggerAdapter;
  maxMessageBytes: number;
  /** Filter / transform the spawn env. Defaults to copying `process.env`. */
  prepareEnv?: (clientEnv: Record<string, string> | undefined) => NodeJS.ProcessEnv;
  /** Validate the requested cwd; throw to refuse the start. */
  assertCwdAllowed?: (cwd: string) => void;
}

/**
 * One pty + WebSocket pair. The client must send a `start` frame as its
 * first message; until then the session stays in `pending` and ignores
 * (rejects, actually) any other frame type.
 */
export class PtySession {
  private readonly ws: WebSocket;
  private readonly sessionId: string;
  private readonly logger: LoggerAdapter;
  private readonly maxMessageBytes: number;
  private readonly prepareEnv: (env: Record<string, string> | undefined) => NodeJS.ProcessEnv;
  private readonly assertCwdAllowed: (cwd: string) => void;

  private pty: IPty | null = null;
  private state: 'pending' | 'running' | 'closed' = 'pending';

  constructor(options: PtySessionOptions) {
    this.ws = options.ws;
    this.sessionId = options.sessionId;
    this.logger = options.logger;
    this.maxMessageBytes = options.maxMessageBytes;
    this.prepareEnv =
      options.prepareEnv ?? ((clientEnv) => ({ ...process.env, ...(clientEnv ?? {}) }));
    this.assertCwdAllowed =
      options.assertCwdAllowed ??
      (() => {
        /* default: trust the client (loopback-only deployment) */
      });
  }

  attach(): void {
    this.ws.on('message', (raw: RawData) => {
      const byteLength = rawDataByteLength(raw);
      const sizeCheck = assertPtyInboundMessageSizeOk(byteLength, this.maxMessageBytes);
      if (!sizeCheck.ok) {
        this.logger.warn(
          {
            code: sizeCheck.code,
            sessionId: this.sessionId,
            byteLength,
            maxMessageBytes: this.maxMessageBytes,
          },
          'PTY WebSocket inbound message rejected (oversize)',
        );
        this.closeWithError('PTY_WS_MESSAGE_OVERSIZE', 'message too large', 1009);
        return;
      }
      this.handleClientFrame(rawDataToString(raw));
    });

    this.ws.on('close', () => {
      this.dispose('ws-close');
    });

    this.ws.on('error', (err) => {
      this.logger.warn(
        { err, sessionId: this.sessionId, code: 'PTY_WS_SOCKET_ERROR' },
        'PTY WebSocket error',
      );
    });
  }

  private handleClientFrame(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.closeWithError('PTY_INVALID_JSON', 'invalid JSON frame');
      return;
    }
    const result = ptyClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.closeWithError('PTY_INVALID_FRAME', 'unrecognized client frame');
      return;
    }
    const msg = result.data;

    if (this.state === 'pending') {
      if (msg.type !== 'start') {
        this.closeWithError('PTY_NOT_STARTED', 'first frame must be `start`');
        return;
      }
      this.startPty(msg);
      return;
    }

    if (this.state === 'closed') return;

    switch (msg.type) {
      case 'start':
        this.closeWithError('PTY_ALREADY_STARTED', 'pty already started');
        return;
      case 'input':
        this.pty?.write(msg.data);
        return;
      case 'resize':
        try {
          this.pty?.resize(msg.cols, msg.rows);
        } catch (err) {
          this.logger.warn(
            { err, sessionId: this.sessionId, code: 'PTY_RESIZE_FAILED' },
            'PTY resize failed (ignored)',
          );
        }
        return;
      case 'signal':
        try {
          this.pty?.kill(msg.signal);
        } catch (err) {
          this.logger.warn(
            { err, sessionId: this.sessionId, code: 'PTY_SIGNAL_FAILED', signal: msg.signal },
            'PTY signal failed (ignored)',
          );
        }
        return;
      case 'ping':
        this.send({ type: 'pong' });
        return;
    }
  }

  private startPty(start: PtyClientStart): void {
    const cwd = path.resolve(start.cwd);
    try {
      this.assertCwdAllowed(cwd);
    } catch (err) {
      this.logger.warn(
        { err, sessionId: this.sessionId, code: 'PTY_CWD_REJECTED', cwd },
        'PTY start rejected (cwd policy)',
      );
      this.closeWithError('PTY_CWD_REJECTED', err instanceof Error ? err.message : 'cwd rejected');
      return;
    }

    const shell = start.shell ?? defaultShell();
    const cols = start.cols ?? DEFAULT_COLS;
    const rows = start.rows ?? DEFAULT_ROWS;
    const env = this.prepareEnv(start.env);

    let pty: IPty;
    try {
      pty = spawnPty(shell, [], {
        name: DEFAULT_TERM_NAME,
        cols,
        rows,
        cwd,
        env: env as { [key: string]: string },
        useConpty: process.platform === 'win32' ? true : undefined,
      });
    } catch (err) {
      this.logger.error(
        { err, sessionId: this.sessionId, code: 'PTY_SPAWN_FAILED', shell, cwd },
        'PTY spawn failed',
      );
      this.closeWithError(
        'PTY_SPAWN_FAILED',
        err instanceof Error ? err.message : 'pty spawn failed',
      );
      return;
    }

    this.pty = pty;
    this.state = 'running';

    pty.onData((chunk) => {
      this.send({ type: 'data', chunk });
    });
    pty.onExit(({ exitCode, signal }) => {
      this.send({ type: 'exit', code: exitCode, signal: signal ?? null });
      this.dispose('pty-exit');
      try {
        this.ws.close(1000, 'pty exited');
      } catch {
        /* ws may already be closing */
      }
    });

    this.send({ type: 'ready', pid: pty.pid, shell, cwd, cols, rows });
    this.logger.info(
      {
        sessionId: this.sessionId,
        pid: pty.pid,
        shell,
        cwd,
        cols,
        rows,
        host: os.hostname(),
      },
      'PTY session started',
    );
  }

  private send(msg: PtyServerMessage): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      this.logger.warn(
        { err, sessionId: this.sessionId, code: 'PTY_WS_SEND_FAILED', frameType: msg.type },
        'PTY WebSocket send failed',
      );
    }
  }

  private closeWithError(code: string, message: string, wsCloseCode = 1008): void {
    this.send({ type: 'error', code, message });
    this.dispose('error');
    try {
      this.ws.close(wsCloseCode, message.slice(0, 120));
    } catch {
      /* ignore */
    }
  }

  private dispose(reason: 'ws-close' | 'pty-exit' | 'error'): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    if (this.pty) {
      try {
        // Killing on ws-close is essential — otherwise spawned shells linger
        // until the host process exits. node-pty turns this into the right
        // platform-specific termination (SIGHUP on POSIX, ExitProcess on
        // Windows ConPTY).
        this.pty.kill();
      } catch {
        /* already dead */
      }
      this.pty = null;
    }
    this.logger.info(
      { sessionId: this.sessionId, reason },
      'PTY session disposed',
    );
  }
}
