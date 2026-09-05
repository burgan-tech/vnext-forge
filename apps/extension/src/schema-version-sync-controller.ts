import * as path from 'node:path';

import * as vscode from 'vscode';

import {
  applySchemaVersionToPackageJson,
  type FileSystemAdapter,
} from '@vnext-forge-studio/services-core';

import {
  describeMissingPackageJson,
  describeSchemaSyncAction,
  planSchemaVersionSync,
  type SchemaSyncAction,
  type SchemaSyncSolutionInput,
} from './schema-version-sync-plan.js';
import { baseLogger } from './shared/logger.js';
import type { ForgeTerminalManager } from './tools/forge-terminal.js';
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from './workspace-detector.js';

/** Suppress a second `npm install` for the same directory within this window. */
const NPM_INSTALL_COOLDOWN_MS = 5_000;

interface ControllerDeps {
  detector: VnextWorkspaceDetector;
  terminal: ForgeTerminalManager;
  fs: FileSystemAdapter;
}

/**
 * When a solution file's `schemaVersion` changes — through the config wizard
 * (`projects/writeConfig`) or a plain text save — update that solution's
 * `package.json` pin of `@burgan-tech/vnext-schema` and run `npm install` in
 * the Forge terminal.
 *
 * Both write paths end in a watcher event on the solution file, so the
 * detector's `onDidChange` is the single trigger. The very first event only
 * seeds the last-known versions: upgrading the extension must not start an
 * install on its own. npm failures stay in the terminal — nothing here blocks.
 */
export class SchemaVersionSyncController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private lastKnown = new Map<string, string>();
  private seeded = false;
  private readonly recentInstallDirs = new Map<string, number>();
  private readonly warnedMissingPackageJson = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: ControllerDeps) {
    this.disposables.push(
      deps.detector.onDidChange((roots) => {
        this.queue = this.queue.then(() => this.onRootsChanged(roots)).catch((error: unknown) => {
          baseLogger.warn({ error: (error as Error).message }, 'schemaVersion sync pass failed');
        });
      }),
    );
  }

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
  }

  private async onRootsChanged(roots: readonly VnextWorkspaceRoot[]): Promise<void> {
    const inputs = toSyncInputs(roots);
    const { actions, nextLastKnown } = planSchemaVersionSync(this.lastKnown, inputs, {
      seeded: this.seeded,
    });
    this.lastKnown = nextLastKnown;
    this.seeded = true;
    for (const action of actions) {
      await this.apply(action, roots);
    }
  }

  private async apply(action: SchemaSyncAction, roots: readonly VnextWorkspaceRoot[]): Promise<void> {
    baseLogger.info(
      { file: action.filePath, from: action.from, to: action.to, packageJson: action.packageJsonPath },
      'schemaVersion changed in solution file',
    );

    if (!action.packageJsonPath) {
      if (!this.warnedMissingPackageJson.has(action.filePath)) {
        this.warnedMissingPackageJson.add(action.filePath);
        const componentsRoot = findComponentsRoot(roots, action.filePath);
        void vscode.window.showWarningMessage(describeMissingPackageJson(action, componentsRoot));
      }
      return;
    }

    const packageDir = path.dirname(action.packageJsonPath);
    if (!isInsideWorkspace(packageDir)) {
      baseLogger.warn(
        { packageDir },
        'schemaVersion sync skipped: package.json directory is outside every workspace folder',
      );
      return;
    }

    const relPackageJson = toRelPosix(action.rootPath, action.packageJsonPath);
    try {
      // Idempotent: the `projects/writeConfig` RPC may already have written the
      // same range, in which case only the install still has to run.
      await applySchemaVersionToPackageJson(this.deps.fs, action.packageJsonPath, action.to);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      baseLogger.warn({ packageJson: action.packageJsonPath, error: message }, 'package.json update failed');
      void vscode.window.showWarningMessage(
        `vNext Forge: schemaVersion changed in ${action.fileName}, but ${relPackageJson} could not be updated. ${message}`,
      );
      return;
    }

    const now = Date.now();
    const last = this.recentInstallDirs.get(packageDir);
    if (last !== undefined && now - last < NPM_INSTALL_COOLDOWN_MS) {
      baseLogger.info({ packageDir }, 'npm install already started for this directory; skipping duplicate');
      return;
    }
    this.recentInstallDirs.set(packageDir, now);

    this.deps.terminal.run('npm install', { cwd: packageDir, show: true });
    void vscode.window.showInformationMessage(describeSchemaSyncAction(action, relPackageJson));
  }
}

function toSyncInputs(roots: readonly VnextWorkspaceRoot[]): SchemaSyncSolutionInput[] {
  const inputs: SchemaSyncSolutionInput[] = [];
  for (const root of roots) {
    for (const solution of root.solutions) {
      const config = solution.config;
      if (solution.status.status !== 'ok' || !config) continue;
      inputs.push({
        filePath: solution.filePath,
        fileName: solution.fileName,
        rootPath: root.folderPath,
        domain: config.domain,
        schemaVersion: config.schemaVersion,
        ...(solution.packageJsonPath ? { packageJsonPath: solution.packageJsonPath } : {}),
      });
    }
  }
  return inputs;
}

function findComponentsRoot(roots: readonly VnextWorkspaceRoot[], filePath: string): string | undefined {
  const key = filePath.replace(/\\/g, '/');
  for (const root of roots) {
    const solution = root.solutions.find((s) => s.filePath.replace(/\\/g, '/') === key);
    if (solution?.config) return solution.config.paths.componentsRoot.trim() || undefined;
  }
  return undefined;
}

function isInsideWorkspace(dir: string): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const target = path.resolve(dir);
  return folders.some((folder) => {
    const rel = path.relative(path.resolve(folder.uri.fsPath), target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

function toRelPosix(rootPath: string, filePath: string): string {
  const rel = path.relative(path.resolve(rootPath), path.resolve(filePath));
  return rel.split(path.sep).join('/');
}
