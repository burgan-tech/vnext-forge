import { execFile } from 'node:child_process';

import { buildChildEnv, DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST } from '@vnext-forge-studio/services-core';

/**
 * `SAFE_SHELL_ARG` (services-core) tolerates `%`, `,` and `=` because it is
 * shared with bash/zsh/pwsh quoting, where none of those are meta. On
 * cmd.exe — the tokenizer `shell: true` hands argv to on win32 — `%` triggers
 * variable expansion (`%PATH%`) even inside an unquoted token, and `,`/`=`
 * are argument separators in cmd.exe's own parsing. `runWfCaptured` only ever
 * spawns through cmd.exe on win32, so it refuses those here rather than
 * relying on the POSIX-oriented allowlist.
 */
const WIN32_SAFE_SHELL_ARG = /^[A-Za-z0-9_/.:@+~-]+$/;

/**
 * Captured (non-terminal) Workflow CLI run for commands whose result Forge must
 * parse and that never prompt (`wf indexes generate`). No stdin is attached, so
 * an interactive command would hang until the timeout — do not use this for
 * `wf update` / `wf reset`, which stay in the Forge terminal.
 *
 * On Windows `wf` is a `.cmd` shim, so `shell` is on there (same as
 * `execFileWfVersion`); argv must then hold only shell-safe tokens (flow keys
 * are validated by `buildWfIndexesGenerateArgv`).
 */
export interface WfCapturedResult {
  /** Process exit code; `null` when the process could not start or was killed. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Why there is no exit code (binary missing, timeout). */
  errorMessage?: string;
}

export interface WfExecOptions {
  cwd: string;
  timeout: number;
  shell: boolean;
  env: NodeJS.ProcessEnv;
  encoding: 'utf8';
  maxBuffer: number;
  windowsHide: boolean;
}

export type WfExecFileFn = (
  file: string,
  args: readonly string[],
  options: WfExecOptions,
  callback: (error: (Error & { code?: unknown; killed?: boolean }) | null, stdout: string, stderr: string) => void,
) => void;

const defaultExec: WfExecFileFn = (file, args, options, callback) => {
  execFile(file, [...args], options, (error, stdout, stderr) => {
    callback(error as (Error & { code?: unknown; killed?: boolean }) | null, String(stdout), String(stderr));
  });
};

export function runWfCaptured(
  argv: readonly string[],
  opts: { cwd: string; timeoutMs: number },
  exec: WfExecFileFn = defaultExec,
): Promise<WfCapturedResult> {
  return new Promise((resolve) => {
    const isWin32 = process.platform === 'win32';
    if (isWin32) {
      // `shell: true` on Windows (the `.cmd` shim) hands argv to cmd.exe's own
      // tokenizer; an unquoted token outside this set could be reinterpreted
      // as a shell operator. Refuse rather than spawn.
      const unsafeToken = argv.find((token) => !WIN32_SAFE_SHELL_ARG.test(token));
      if (unsafeToken !== undefined) {
        resolve({
          exitCode: null,
          stdout: '',
          stderr: '',
          errorMessage: `"${unsafeToken}" is not a safe argument to pass to the Workflow CLI on Windows.`,
        });
        return;
      }
    }
    exec(
      'wf',
      argv,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        shell: isWin32,
        env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ exitCode: 0, stdout, stderr });
          return;
        }
        if (typeof error.code === 'number') {
          // A non-zero exit still carries the CLI's own explanation on stderr
          // (e.g. Windows' "'wf' is not recognized..." when the shim itself is
          // missing) — surface it so the caller doesn't have to re-derive it.
          const trimmedStderr = stderr.trim();
          resolve({
            exitCode: error.code,
            stdout,
            stderr,
            ...(trimmedStderr ? { errorMessage: trimmedStderr } : {}),
          });
          return;
        }
        const errorMessage = error.killed
          ? `The Workflow CLI did not finish within ${Math.round(opts.timeoutMs / 1000)}s.`
          : error.code === 'ENOENT'
            ? 'The Workflow CLI (wf) was not found on PATH.'
            : error.message;
        resolve({ exitCode: null, stdout, stderr, errorMessage });
      },
    );
  });
}
