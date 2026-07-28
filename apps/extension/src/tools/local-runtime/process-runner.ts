import { spawn } from 'node:child_process';
import * as path from 'node:path';

import {
  buildChildEnv,
  DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST,
} from '@vnext-forge-studio/services-core';
import type * as vscode from 'vscode';

import { redactSecrets } from '../../shared/redact.js';
import { wellKnownDirs } from './tool-lookup.js';

/**
 * PATH for spawned children: the inherited PATH plus the directories
 * `tool-lookup` searches.
 *
 * This is the child-process half of the problem `tool-lookup` solves. Resolving
 * `make` to an absolute path is not enough: the runtime repo's Makefile does its
 * own `command -v orb / docker / podman` against whatever PATH it inherits, and
 * a Dock-launched VS Code on macOS passes down launchd's
 * `/usr/bin:/bin:/usr/sbin:/sbin` — no `/usr/local/bin`, no `/opt/homebrew/bin`.
 * Without this, preflight passes and then `make setup` dies with
 * "No container runtime detected!", which sends the reader debugging the wrong
 * layer entirely. Do not remove this without also removing `tool-lookup`.
 *
 * Appended, never prepended: the user's own PATH keeps priority. Deduplicated so
 * an already-complete PATH does not accumulate entries.
 */
function augmentedPath(): string {
  const merged: string[] = [];
  const seen = new Set<string>();
  const inherited = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of [...inherited, ...wellKnownDirs()]) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    merged.push(dir);
  }
  return merged.join(path.delimiter);
}

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
      env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST, { PATH: augmentedPath() }),
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
