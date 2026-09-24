import { execFile } from 'node:child_process';

import {
  extractCoreSemver,
  wfSupportsDomainFlag,
  wfSupportsIndexes,
  wfSupportsPublishCompleted,
} from '@vnext-forge-studio/services-core';

export interface WfCliInfo {
  installed: boolean;
  /** Core semver (`1.0.13`) when the CLI printed one. */
  version?: string;
  /** Installed CLI understands the global `--domain` option (≥ 1.0.13). */
  supportsDomainFlag: boolean;
  /** `wf indexes generate` is available (≥ `WF_INDEXES_MIN_VERSION`). */
  supportsIndexes: boolean;
  /**
   * The CLI signals publish-completed after publishing, so the runtime refreshes
   * its discovery cache (≥ `WF_PUBLISH_COMPLETED_MIN_VERSION`).
   */
  supportsPublishCompleted: boolean;
}

export const WF_CLI_NOT_INSTALLED: WfCliInfo = Object.freeze({
  installed: false,
  supportsDomainFlag: false,
  supportsIndexes: false,
  supportsPublishCompleted: false,
});

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
  private readonly invalidateListeners = new Set<() => void>();

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
          supportsIndexes: wfSupportsIndexes(version),
          supportsPublishCompleted: wfSupportsPublishCompleted(version),
        };
      },
      () => {
        this.pending = undefined;
        return { ...WF_CLI_NOT_INSTALLED };
      },
    );
    return this.pending;
  }

  /** Called on every `invalidate()` — tree views re-render their CLI-dependent nodes. */
  onDidInvalidate(listener: () => void): { dispose(): void } {
    this.invalidateListeners.add(listener);
    return {
      dispose: () => {
        this.invalidateListeners.delete(listener);
      },
    };
  }

  invalidate(): void {
    this.pending = undefined;
    for (const listener of [...this.invalidateListeners]) listener();
  }
}
