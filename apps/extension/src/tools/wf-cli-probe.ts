import { execFile } from 'node:child_process';

import { extractCoreSemver, wfSupportsDomainFlag } from '@vnext-forge-studio/services-core';

export interface WfCliInfo {
  installed: boolean;
  /** Core semver (`1.0.13`) when the CLI printed one. */
  version?: string;
  /** Installed CLI understands the global `--domain` option (≥ 1.0.13). */
  supportsDomainFlag: boolean;
}

/** Resolves the stdout of `wf --version`; rejects when the binary is missing or fails. */
export type ExecVersionFn = () => Promise<string>;

export function execFileWfVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'wf',
      ['--version'],
      { timeout: 10_000, shell: process.platform === 'win32' },
      (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(String(stdout));
      },
    );
  });
}

/**
 * One `wf --version` probe shared by every Forge Tools surface that shells out
 * to the Workflow CLI. The result is memoized; a failed probe (CLI missing) is
 * not, so an install made mid-session is picked up on the next call.
 * `invalidate()` after installs/updates.
 */
export class WfCliProbe {
  private pending: Promise<WfCliInfo> | undefined;

  constructor(private readonly exec: ExecVersionFn = execFileWfVersion) {}

  get(): Promise<WfCliInfo> {
    this.pending ??= this.exec().then(
      (stdout) => {
        const trimmed = stdout.trim();
        const version = extractCoreSemver(trimmed) ?? (trimmed.length > 0 ? trimmed : undefined);
        return {
          installed: true,
          ...(version ? { version } : {}),
          supportsDomainFlag: wfSupportsDomainFlag(version),
        };
      },
      () => {
        this.pending = undefined;
        return { installed: false, supportsDomainFlag: false };
      },
    );
    return this.pending;
  }

  invalidate(): void {
    this.pending = undefined;
  }
}
