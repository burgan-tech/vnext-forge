import { spawn } from 'node:child_process';

import type { ProcessAdapter } from '@vnext-forge/services-core';

/**
 * Concrete `ProcessAdapter` for Node-based shells. Runs the supplied script
 * with the same Node binary the host is already using, returning combined
 * stdout/stderr. Throws a generic `Error` (NOT `VnextForgeError`) on non-zero
 * exit so the calling service can attach the right context.
 */
export function createNodeProcessAdapter(): ProcessAdapter {
  return {
    runNode({ scriptPath, scriptArgs, cwd, timeoutMs, env }) {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
          cwd,
          env: { ...process.env, ...env } as NodeJS.ProcessEnv,
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
