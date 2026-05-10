import { z } from 'zod';

/**
 * WebSocket message protocol for the integrated terminal.
 *
 * Both directions are JSON-encoded text frames. The renderer opens a WS at
 * `/api/pty`, sends a `start` frame, then exchanges `input` / `resize` /
 * `signal` while the host streams `data` / `exit`.
 *
 * No binary frames; pty output is UTF-8 (node-pty's default), and ANSI
 * escapes are pure ASCII. JSON is the cheaper protocol surface to maintain
 * and stays readable in the server log.
 */

// ── client → server ────────────────────────────────────────────────────────

export const ptyClientStartSchema = z.object({
  type: z.literal('start'),
  cwd: z.string().min(1),
  shell: z.string().min(1).optional(),
  cols: z.number().int().min(1).max(1000).optional(),
  rows: z.number().int().min(1).max(1000).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const ptyClientInputSchema = z.object({
  type: z.literal('input'),
  data: z.string(),
});

export const ptyClientResizeSchema = z.object({
  type: z.literal('resize'),
  cols: z.number().int().min(1).max(1000),
  rows: z.number().int().min(1).max(1000),
});

export const ptyClientSignalSchema = z.object({
  type: z.literal('signal'),
  signal: z.enum(['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGHUP']),
});

export const ptyClientPingSchema = z.object({
  type: z.literal('ping'),
});

export const ptyClientMessageSchema = z.discriminatedUnion('type', [
  ptyClientStartSchema,
  ptyClientInputSchema,
  ptyClientResizeSchema,
  ptyClientSignalSchema,
  ptyClientPingSchema,
]);

export type PtyClientMessage = z.infer<typeof ptyClientMessageSchema>;
export type PtyClientStart = z.infer<typeof ptyClientStartSchema>;

// ── server → client ────────────────────────────────────────────────────────

export interface PtyServerReady {
  type: 'ready';
  pid: number;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export interface PtyServerData {
  type: 'data';
  chunk: string;
}

export interface PtyServerExit {
  type: 'exit';
  code: number;
  signal: number | null;
}

export interface PtyServerError {
  type: 'error';
  code: string;
  message: string;
}

export interface PtyServerPong {
  type: 'pong';
}

export type PtyServerMessage =
  | PtyServerReady
  | PtyServerData
  | PtyServerExit
  | PtyServerError
  | PtyServerPong;
