import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import * as vscode from 'vscode';

import {
  CONFIG_FILE,
  isSolutionFileName,
  resolveSolutionForComponent,
  resolveSolutionForPath as resolveSolutionForPathCore,
  scanSolutionRoot,
  type FileSystemAdapter,
  type SolutionIssue,
  type VnextSolutionFile,
} from '@vnext-forge-studio/services-core';

import { baseLogger } from './shared/logger.js';

export const VNEXT_CONTEXT_KEY = 'vnextForge.isVnextWorkspace';

/** Debounce for bursts of solution-file events (wizard save + formatter + watcher echo). */
const REFRESH_DEBOUNCE_MS = 200;

/**
 * One VS Code workspace folder that holds at least one solution file.
 *
 * `configPath` is kept for callers that only know about the default
 * `vnext.config.json`; it points at that file even when it does not exist
 * (a root may consist of domain-suffixed solutions only) — prefer
 * `defaultSolution` / `solutions`.
 */
export interface VnextWorkspaceRoot {
  folderUri: vscode.Uri;
  folderPath: string;
  configPath: string;
  /** Every solution file found directly in the folder (all statuses). */
  solutions: VnextSolutionFile[];
  defaultSolution?: VnextSolutionFile;
  /** Cross-file validation results for this root (published to the Problems panel). */
  issues: SolutionIssue[];
}

export interface ResolvedSolution {
  root: VnextWorkspaceRoot;
  /** Always `status.status === 'ok'` with a `config`. */
  solution: VnextSolutionFile;
  /** Component-level warnings produced while resolving (unknown domain, path outside root). */
  issues: SolutionIssue[];
}

/**
 * Scan all open workspace folders for solution files (`vnext.config.json`,
 * `vnext.<domain>.config.json`). Folders are scanned in parallel; a folder
 * qualifies as a vNext root when it holds at least one solution file, valid or not.
 */
export async function detectVnextWorkspaceRoots(
  fsAdapter: FileSystemAdapter,
): Promise<VnextWorkspaceRoot[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const scanned = await Promise.all(
    folders.map(async (folder) => {
      const folderPath = folder.uri.fsPath;
      try {
        const scan = await scanSolutionRoot(fsAdapter, folderPath);
        if (scan.solutions.length === 0) return null;
        const root: VnextWorkspaceRoot = {
          folderUri: folder.uri,
          folderPath,
          configPath: path.join(folderPath, CONFIG_FILE),
          solutions: scan.solutions,
          issues: scan.issues,
          ...(scan.defaultSolution ? { defaultSolution: scan.defaultSolution } : {}),
        };
        return root;
      } catch (error) {
        baseLogger.error(
          { folder: folderPath, error: (error as Error).message },
          'Failed to scan workspace folder for solution files',
        );
        return null;
      }
    }),
  );
  return scanned.filter((root): root is VnextWorkspaceRoot => root !== null);
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

function isOkSolution(solution: VnextSolutionFile | undefined): solution is VnextSolutionFile {
  return !!solution && solution.status.status === 'ok' && !!solution.config;
}

/** Best-effort `$.domain` of a component JSON; `undefined` when unreadable or absent. */
async function readComponentDomain(fsPath: string, text?: string): Promise<string | undefined> {
  try {
    const raw = text ?? (await fs.readFile(fsPath, 'utf-8'));
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const domain = (parsed as { domain?: unknown }).domain;
    return typeof domain === 'string' && domain.trim() ? domain.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Centralised workspace detection state. Keeps the detected roots in sync with
 * VS Code workspace folder / solution-file changes and broadcasts the
 * `isVnextWorkspace` context key. Validation results travel on each root's
 * `issues`; publishing them is the `SolutionDiagnosticsPublisher`'s job.
 */
export class VnextWorkspaceDetector implements vscode.Disposable {
  private roots: VnextWorkspaceRoot[] = [];
  private readonly fs: FileSystemAdapter;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<VnextWorkspaceRoot[]>();
  private refreshTimer: NodeJS.Timeout | undefined;
  private refreshQueue: Promise<void> = Promise.resolve();

  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(fsAdapter: FileSystemAdapter) {
    this.fs = fsAdapter;
    // `vnext*.config.json` over-matches (e.g. `vnext-foo.config.json`); the
    // handler narrows to real solution file names at a workspace root.
    this.watcher = vscode.workspace.createFileSystemWatcher('**/vnext*.config.json');
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate((uri) => this.onSolutionFileEvent(uri)),
      this.watcher.onDidDelete((uri) => this.onSolutionFileEvent(uri)),
      this.watcher.onDidChange((uri) => this.onSolutionFileEvent(uri)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.scheduleRefresh()),
    );
  }

  getRoots(): readonly VnextWorkspaceRoot[] {
    return this.roots;
  }

  /** Every solution file across all roots (all statuses). */
  getSolutions(): { root: VnextWorkspaceRoot; solution: VnextSolutionFile }[] {
    return this.roots.flatMap((root) => root.solutions.map((solution) => ({ root, solution })));
  }

  findOwningRoot(targetFsPath: string): VnextWorkspaceRoot | undefined {
    return findOwningRoot(targetFsPath, this.roots);
  }

  /**
   * Which solution does a file belong to?
   *
   * - A solution file resolves to itself (by name) when it is valid.
   * - A component resolves by its own `$.domain` first (pass `componentDomain`
   *   or the document `text` to avoid a disk read), then by path containment,
   *   then to the root's default solution — see `resolveSolutionForComponent`.
   */
  async resolveSolutionForFile(
    fsPath: string,
    opts?: { componentDomain?: string; text?: string },
  ): Promise<ResolvedSolution | undefined> {
    const root = this.findOwningRoot(fsPath);
    if (!root) return undefined;

    const fileName = path.basename(fsPath);
    if (isSolutionFileName(fileName) && path.resolve(path.dirname(fsPath)) === path.resolve(root.folderPath)) {
      const own = root.solutions.find((s) => s.fileName.toLowerCase() === fileName.toLowerCase());
      return isOkSolution(own) ? { root, solution: own, issues: [] } : undefined;
    }

    const domain = opts?.componentDomain ?? (await readComponentDomain(fsPath, opts?.text));
    const { solution, issues } = resolveSolutionForComponent(root.solutions, domain, fsPath);
    if (!isOkSolution(solution)) return undefined;
    return { root, solution, issues };
  }

  /**
   * Path-only resolution for files without a `$.domain` (`.csx`, folders):
   * the solution whose `componentsRoot` contains the path, else the root's
   * default solution when it is valid.
   */
  resolveSolutionForPath(fsPath: string): ResolvedSolution | undefined {
    const root = this.findOwningRoot(fsPath);
    if (!root) return undefined;
    const byPath = resolveSolutionForPathCore(root.solutions, fsPath);
    const solution = isOkSolution(byPath) ? byPath : root.defaultSolution;
    if (!isOkSolution(solution)) return undefined;
    return { root, solution, issues: [] };
  }

  /** Coalesce bursts of watcher events into a single refresh. */
  scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }

  /** Re-scan every workspace folder. Concurrent calls are serialized. */
  refresh(): Promise<void> {
    this.refreshQueue = this.refreshQueue.then(() => this.doRefresh());
    return this.refreshQueue;
  }

  private async doRefresh(): Promise<void> {
    this.roots = await detectVnextWorkspaceRoots(this.fs);
    const isVnext = this.roots.length > 0;
    await vscode.commands.executeCommand('setContext', VNEXT_CONTEXT_KEY, isVnext);
    for (const root of this.roots) {
      for (const solution of root.solutions) {
        if (solution.status.status === 'ok') {
          baseLogger.info(
            { folder: root.folderPath, file: solution.fileName, domain: solution.config?.domain },
            'vnext solution detected',
          );
        } else if (solution.status.status === 'invalid') {
          baseLogger.warn(
            { folder: root.folderPath, file: solution.fileName, message: solution.status.message },
            'vnext solution file is invalid',
          );
        }
      }
    }
    this.onDidChangeEmitter.fire(this.roots);
  }

  private onSolutionFileEvent(uri: vscode.Uri): void {
    if (!isSolutionFileName(path.basename(uri.fsPath))) return;
    const dir = path.resolve(path.dirname(uri.fsPath));
    const isWorkspaceRoot = (vscode.workspace.workspaceFolders ?? []).some(
      (folder) => path.resolve(folder.uri.fsPath) === dir,
    );
    if (!isWorkspaceRoot) return;
    this.scheduleRefresh();
  }

  dispose(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
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
