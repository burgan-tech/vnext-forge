import { spawn } from 'node:child_process';

import {
  buildChildEnv,
  DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST,
} from '@vnext-forge-studio/services-core';
import type * as vscode from 'vscode';

import { redactSecrets } from '../../shared/redact.js';

export interface RunStreamingOptions {
  cwd: string;
  /** Called once per output line, stdout and stderr interleaved. */
  onLine: (line: string) => void;
  token?: vscode.CancellationToken;
}

export interface RunStreamingResult {
  exitCode: number;
  /** Everything emitted, already redacted. Used for error messages. */
  output: string;
  cancelled: boolean;
}

/**
 * Spawn a command and stream its output line by line.
 *
 * Provisioning chains several steps and each one's exit code decides whether
 * the next runs — which is why this exists instead of sending commands to a
 * terminal, where the completion signal is not reliable.
 */
export function runStreaming(
  file: string,
  argv: readonly string[],
  options: RunStreamingOptions,
): Promise<RunStreamingResult> {
  return new Promise((resolve) => {
    const child = spawn(file, [...argv], {
      cwd: options.cwd,
      env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
      shell: false,
    });

    let collected = '';
    let cancelled = false;
    let pending = '';

    const emit = (chunk: string) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const safe = redactSecrets(line);
        collected += `${safe}\n`;
        options.onLine(safe);
      }
    };

    child.stdout?.on('data', (d: Buffer) => emit(d.toString('utf8')));
    child.stderr?.on('data', (d: Buffer) => emit(d.toString('utf8')));

    const cancelSub = options.token?.onCancellationRequested(() => {
      cancelled = true;
      child.kill('SIGTERM');
    });

    const finish = (exitCode: number) => {
      if (pending.length > 0) {
        const safe = redactSecrets(pending);
        collected += `${safe}\n`;
        options.onLine(safe);
        pending = '';
      }
      cancelSub?.dispose();
      resolve({ exitCode, output: collected, cancelled });
    };

    child.on('error', (err) => {
      const safe = redactSecrets(err.message);
      collected += `${safe}\n`;
      options.onLine(safe);
      // ENOENT here means our resolved path went stale; the caller re-detects.
      finish(127);
    });

    child.on('close', (code) => finish(code ?? 1));
  });
}
