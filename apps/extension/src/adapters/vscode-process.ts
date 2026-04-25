import { spawn } from 'node:child_process';

import {
  buildChildEnv,
  DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST,
  type ProcessAdapter,
} from '@vnext-forge/services-core';

/**
 * VS Code extension host `ProcessAdapter`.
 *
 * The extension host runs in Node.js, so we reuse `child_process.spawn`. Kept
 * as a dedicated module (instead of sharing the web-server adapter) because
 * the extension may eventually prefer `vscode.window.createTerminal` for
 * user-visible scaffolding — the indirection localises that change.
 */
export function createVsCodeProcessAdapter(): ProcessAdapter {
  return {
    runNode({ scriptPath, scriptArgs, cwd, timeoutMs, env }) {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
          cwd,
          env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST, env),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const timer = timeoutMs
          ? setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, timeoutMs)
          : undefined;

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf-8');
        });
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });

        child.on('error', (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });

        child.on('close', (code) => {
          if (timer) clearTimeout(timer);
          if (timedOut) {
            reject(new Error(`Process timed out after ${String(timeoutMs)}ms`));
            return;
          }
          if (code !== 0) {
            reject(new Error(`Process exited with code ${String(code)}: ${stderr || stdout}`));
            return;
          }
          resolve({ stdout, stderr });
        });
      });
    },
  };
}
