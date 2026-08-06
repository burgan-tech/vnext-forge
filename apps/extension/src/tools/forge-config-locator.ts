import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Which copy of a config file is in play.
 *
 * `'workspace'` means the file exists under the user's own workspace and is
 * therefore shared with anyone who clones the repo; `'local'` means the
 * machine-local copy in the extension's globalStorage.
 */
export type ForgeConfigSource = 'workspace' | 'local';

export interface ResolvedConfigPath {
  path: string;
  source: ForgeConfigSource;
}

/**
 * The shared-config folder, relative to the workspace root.
 *
 * `.vnextstudio/` is already the convention for Git-tracked, team-shared Forge
 * state — `snippets.service.ts`'s `dirForScope` puts project snippets under
 * `<project>/.vnextstudio/snippets/` and documents them as exactly that. Forge
 * Tools config becomes a sibling rather than a second, competing convention.
 */
export const WORKSPACE_CONFIG_DIR = path.join('.vnextstudio', 'forge-tools');

/**
 * Decides, for one relative config file name, whether the workspace copy or the
 * machine-local copy is in play.
 *
 * Extracted from `ForgeToolsSettingsService` and `DataBucketService` — both used
 * to hard-code `globalStorageUri` in their constructors, and both now need the
 * same workspace-first rule. One place to change it, one place to test it.
 *
 * ### The rule
 *
 * **Per file, workspace wins, local is the fallback.** Not a per-key merge: a
 * developer looking at a wrong header needs to answer "which file is this coming
 * from" by looking at one path, not by reasoning about which keys won.
 *
 * **Writes follow reads.** `resolveWrite` returns the same file `resolveRead`
 * would pick, so editing a setting changes the value the runner actually uses. A
 * "writes always go local" rule would mean the workspace copy silently overrides
 * every local edit — the user saves, nothing changes, and nothing says why.
 *
 * ### No `vscode` import
 *
 * This module takes a plain directory string and a callback, deliberately: the
 * extension host has no test harness that can load the `vscode` module, and the
 * resolution table above is the part of this feature most worth pinning.
 */
export class ForgeConfigLocator {
  /**
   * @param globalStorageDir  Machine-local config root (`context.globalStorageUri.fsPath`).
   * @param getWorkspaceRoot  Live getter for the active workspace root, or `null`
   *   when there is no folder open. A callback rather than a value so a folder
   *   change is picked up without reconstructing every service that holds one —
   *   the same live-callback shape `RuntimeProxyService` takes for its allowlist.
   */
  constructor(
    private readonly globalStorageDir: string,
    private readonly getWorkspaceRoot: () => string | null,
  ) {}

  /** The shared-config directory, or `null` when no workspace folder is open. */
  workspaceDir(): string | null {
    const root = this.getWorkspaceRoot();
    return root ? path.join(root, WORKSPACE_CONFIG_DIR) : null;
  }

  localDir(): string {
    return this.globalStorageDir;
  }

  localPath(relPath: string): string {
    return path.join(this.globalStorageDir, relPath);
  }

  /** The workspace path for `relPath`, or `null` when no folder is open. */
  workspacePath(relPath: string): string | null {
    const dir = this.workspaceDir();
    return dir ? path.join(dir, relPath) : null;
  }

  /**
   * Where to read `relPath` from: the workspace copy when it exists on disk,
   * otherwise the machine-local one.
   *
   * Existence is checked on every call rather than cached — a teammate's
   * `git pull` can create the file at any moment, and the callers already cache
   * the parsed *contents*, so this only costs one `stat` per cache miss.
   */
  async resolveRead(relPath: string): Promise<ResolvedConfigPath> {
    const workspace = this.workspacePath(relPath);
    if (workspace && (await exists(workspace))) {
      return { path: workspace, source: 'workspace' };
    }
    return { path: this.localPath(relPath), source: 'local' };
  }

  /**
   * Where a save of `relPath` goes.
   *
   * Identical to `resolveRead` by construction — see the class comment on why
   * the two must not diverge. A file that does not exist in the workspace yet is
   * *not* created here: adopting the workspace is an explicit action
   * (`ensureWorkspaceDir` + the Save to Workspace command), never a side effect
   * of changing a setting.
   */
  async resolveWrite(relPath: string): Promise<ResolvedConfigPath> {
    return this.resolveRead(relPath);
  }

  /**
   * Creates the shared-config directory and returns it.
   *
   * @throws when no workspace folder is open — callers reach this only from an
   * explicit user action, so a stated failure beats silently writing somewhere
   * the user did not ask for.
   */
  async ensureWorkspaceDir(): Promise<string> {
    const dir = this.workspaceDir();
    if (!dir) {
      throw new Error('Open a folder before saving Forge Tools config to the workspace.');
    }
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
