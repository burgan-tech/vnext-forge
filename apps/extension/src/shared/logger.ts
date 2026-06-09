import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('vnext-forge-studio');

function format(data: unknown, message?: string): string {
  const msg = message ?? '';
  let dataStr = '';
  if (data !== undefined && data !== null && !(typeof data === 'object' && Object.keys(data as object).length === 0)) {
    try {
      dataStr = JSON.stringify(data);
    } catch {
      dataStr = String(data);
    }
  }
  return [msg, dataStr].filter(Boolean).join(' ');
}

/**
 * Single line format aligned with `createLogger.ts` (designer-ui) and
 * `vscode-log-sink.ts` (webview → host bridge):
 *
 *   `[2026-06-02T01:21:25.317Z] [LEVEL] message {payload-json}`
 *
 * The leading ISO timestamp lets users correlate Output Channel lines
 * with X-Trace-Id values surfaced in the webview without guessing what
 * "the same time" means across processes.
 */
function emit(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', data: unknown, message?: string): void {
  const ts = new Date().toISOString();
  outputChannel.appendLine(`[${ts}] [${level}] ${format(data, message)}`);
}

export const baseLogger = {
  info(data: unknown, message?: string): void {
    emit('INFO', data, message);
  },
  warn(data: unknown, message?: string): void {
    emit('WARN', data, message);
  },
  error(data: unknown, message?: string): void {
    emit('ERROR', data, message);
  },
  debug(data: unknown, message?: string): void {
    emit('DEBUG', data, message);
  },
  child(_bindings: Record<string, unknown>) {
    return baseLogger;
  },
};
