import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('vnext-forge');

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

export const baseLogger = {
  info(data: unknown, message?: string): void {
    outputChannel.appendLine(`[INFO] ${format(data, message)}`);
  },
  warn(data: unknown, message?: string): void {
    outputChannel.appendLine(`[WARN] ${format(data, message)}`);
  },
  error(data: unknown, message?: string): void {
    outputChannel.appendLine(`[ERROR] ${format(data, message)}`);
  },
  debug(data: unknown, message?: string): void {
    outputChannel.appendLine(`[DEBUG] ${format(data, message)}`);
  },
  child(_bindings: Record<string, unknown>) {
    return baseLogger;
  },
};
