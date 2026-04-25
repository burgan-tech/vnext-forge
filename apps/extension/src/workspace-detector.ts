import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import * as vscode from 'vscode';

import { CONFIG_FILE, type WorkspaceService } from '@vnext-forge/services-core';

import { baseLogger } from './shared/logger.js';

export const VNEXT_CONTEXT_KEY = 'vnextForge.isVnextWorkspace';

export interface VnextWorkspaceRoot {
  folderUri: vscode.Uri;
  folderPath: string;
  configPath: string;
}

/**
 * Scan all open workspace folders for `vnext.config.json`.
 * Returns every folder that has the config at its root.
 */
export async function detectVnextWorkspaceRoots(): Promise<VnextWorkspaceRoot[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const roots: VnextWorkspaceRoot[] = [];

  for (const folder of folders) {
    const folderPath = folder.uri.fsPath;
    const configPath = path.join(folderPath, CONFIG_FILE);
    try {
      const stat = await fs.stat(configPath);
      if (stat.isFile()) {
        roots.push({ folderUri: folder.uri, folderPath, configPath });
      }
    } catch {
      // No config in this folder — skip.
    }
  }

  return roots;
}

/** Find the workspace root that owns a given file URI/path, if any. */
export function findOwningRoot(
  targetFsPath: string,
  roots: readonly VnextWorkspaceRoot[],
): VnextWorkspaceRoot | undefined {
  const normalizedTarget = path.resolve(targetFsPath);
  let best: VnextWorkspaceRoot | undefined;
  for (const root of roots) {
    const normalizedRoot = path.resolve(root.folderPath);
    const rel = path.relative(normalizedRoot, normalizedTarget);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      if (!best || root.folderPath.length > best.folderPath.length) {
        best = root;
      }
    }
  }
  return best;
}

/**
 * Validate every detected root's `vnext.config.json` and surface human-readable
 * warnings for invalid files. Roots with missing config have already been filtered.
 */
export async function validateDetectedRoots(
  roots: readonly VnextWorkspaceRoot[],
  workspaceService: WorkspaceService,
): Promise<void> {
  for (const root of roots) {
    try {
      const status = await workspaceService.readConfigStatus(root.folderPath);
      if (status.status === 'invalid') {
        baseLogger.warn(
          { folder: root.folderPath, message: status.message },
          'vnext.config.json is invalid',
        );
        void vscode.window.showWarningMessage(
          `vnext-forge: ${path.basename(root.folderPath)}/vnext.config.json is invalid. ${status.message}`,
        );
      } else if (status.status === 'ok') {
        baseLogger.info(
          { folder: root.folderPath, domain: status.config.domain },
          'vnext workspace detected',
        );
      }
    } catch (error) {
      baseLogger.error(
        { folder: root.folderPath, error: (error as Error).message },
        'Failed to validate vnext.config.json',
      );
    }
  }
}

/**
 * Centralised workspace detection state. Keeps the detected roots in sync with
 * VS Code workspace folder / file changes and broadcasts the `isVnextWorkspace`
 * context key.
 */
export class VnextWorkspaceDetector implements vscode.Disposable {
  private roots: VnextWorkspaceRoot[] = [];
  private readonly workspaceService: WorkspaceService;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<VnextWorkspaceRoot[]>();

  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(workspaceService: WorkspaceService) {
    this.workspaceService = workspaceService;
    this.watcher = vscode.workspace.createFileSystemWatcher(`**/${CONFIG_FILE}`);
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate(() => void this.refresh()),
      this.watcher.onDidDelete(() => void this.refresh()),
      this.watcher.onDidChange(() => void this.refresh()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => void this.refresh()),
    );
  }

  getRoots(): readonly VnextWorkspaceRoot[] {
    return this.roots;
  }

  findOwningRoot(targetFsPath: string): VnextWorkspaceRoot | undefined {
    return findOwningRoot(targetFsPath, this.roots);
  }

  async refresh(): Promise<void> {
    this.roots = await detectVnextWorkspaceRoots();
    const isVnext = this.roots.length > 0;
    await vscode.commands.executeCommand('setContext', VNEXT_CONTEXT_KEY, isVnext);
    await validateDetectedRoots(this.roots, this.workspaceService);
    this.onDidChangeEmitter.fire(this.roots);
  }

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.onDidChangeEmitter.dispose();
  }
}
