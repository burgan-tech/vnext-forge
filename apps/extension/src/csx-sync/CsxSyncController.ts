import * as path from 'node:path';
import * as vscode from 'vscode';

import type { WorkspaceService, VnextWorkspaceConfig } from '@vnext-forge-studio/services-core';

import { baseLogger } from '../shared/logger.js';
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../workspace-detector.js';
import { runCsxSync, type CsxSyncRunResult } from './CsxSyncRunner.js';

const SETTING_NAMESPACE = 'vnextForge.csxSync';
const SETTING_ENABLED = 'enabled';
const SETTING_DEBOUNCE = 'debounceMs';
const SETTING_DEFAULT_ENCODING = 'defaultEncoding';

const DEFAULT_DEBOUNCE_MS = 500;
const MIN_DEBOUNCE_MS = 100;
const MAX_DEBOUNCE_MS = 5000;

interface Settings {
  enabled: boolean;
  debounceMs: number;
  defaultEncoding: 'B64' | 'NAT';
}

function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration(SETTING_NAMESPACE);
  const debounce = cfg.get<number>(SETTING_DEBOUNCE, DEFAULT_DEBOUNCE_MS);
  const clamped = Math.min(MAX_DEBOUNCE_MS, Math.max(MIN_DEBOUNCE_MS, debounce | 0));
  const encoding = cfg.get<string>(SETTING_DEFAULT_ENCODING, 'B64');
  return {
    enabled: cfg.get<boolean>(SETTING_ENABLED, true),
    debounceMs: clamped,
    defaultEncoding: encoding === 'NAT' ? 'NAT' : 'B64',
  };
}

function normalizePosix(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

/**
 * List every `.json` file underneath the configured `componentsRoot`
 * for a vNext workspace root. We use `vscode.workspace.findFiles` so
 * we honour `.vscodeignore` / `files.exclude` automatically.
 */
async function listComponentJsonPaths(
  workspaceRoot: string,
  config: VnextWorkspaceConfig,
): Promise<string[]> {
  const componentsRoot = (config.paths?.componentsRoot ?? '').trim();
  if (!componentsRoot) return [];
  const base = vscode.Uri.file(path.join(workspaceRoot, componentsRoot));
  const baseRelPattern = new vscode.RelativePattern(base, '**/*.json');
  const uris = await vscode.workspace.findFiles(baseRelPattern, undefined);
  return uris.map((uri) => normalizePosix(uri.fsPath));
}

interface ControllerDeps {
  detector: VnextWorkspaceDetector;
  workspaceService: WorkspaceService;
}

/**
 * Owns the CSX → component JSON auto-sync feature absorbed from the
 * archived `csx-json-sync` extension. Activation lifecycle:
 *
 *   - Listens to `onDidSaveTextDocument` for `.csx` files inside a
 *     known vNext workspace root, debounced per-file.
 *   - Registers manual sync commands + auto-sync enable/disable
 *     toggles wired to the `vnextForge.csxSync.enabled` setting.
 *
 * The actual sync logic lives in {@link runCsxSync} (pure Node).
 */
export class CsxSyncController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private settings: Settings = readSettings();

  constructor(private readonly deps: ControllerDeps) {}

  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this);
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => this.onDocumentSaved(doc)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(SETTING_NAMESPACE)) {
          const prev = this.settings;
          this.settings = readSettings();
          baseLogger.info(
            {
              enabled: this.settings.enabled,
              debounceMs: this.settings.debounceMs,
              defaultEncoding: this.settings.defaultEncoding,
              wasEnabled: prev.enabled,
            },
            'csx-sync settings updated',
          );
        }
      }),
      vscode.commands.registerCommand('vnextForge.csxSync.syncCurrent', () => this.syncCurrent()),
      vscode.commands.registerCommand('vnextForge.csxSync.syncAll', () => this.syncAll()),
      vscode.commands.registerCommand('vnextForge.csxSync.enable', () => this.toggleEnabled(true)),
      vscode.commands.registerCommand('vnextForge.csxSync.disable', () => this.toggleEnabled(false)),
    );
    baseLogger.info(
      {
        enabled: this.settings.enabled,
        debounceMs: this.settings.debounceMs,
        defaultEncoding: this.settings.defaultEncoding,
      },
      'csx-sync activated',
    );
  }

  dispose(): void {
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
    for (const d of this.disposables) {
      try { d.dispose(); } catch { /* ignore */ }
    }
    this.disposables.length = 0;
  }

  // ── Save → debounced sync ─────────────────────────────────────────

  private onDocumentSaved(doc: vscode.TextDocument): void {
    if (!this.settings.enabled) return;
    if (doc.uri.scheme !== 'file') return;
    if (!doc.uri.fsPath.toLowerCase().endsWith('.csx')) return;

    const owningRoot = this.deps.detector.findOwningRoot(doc.uri.fsPath);
    if (!owningRoot) return;

    const csxPath = doc.uri.fsPath;
    const existing = this.debounceTimers.get(csxPath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(csxPath);
      void this.syncCsxFile(csxPath, owningRoot, { surface: 'silent' });
    }, this.settings.debounceMs);
    this.debounceTimers.set(csxPath, timer);
  }

  // ── Commands ──────────────────────────────────────────────────────

  private async syncCurrent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.uri.fsPath.toLowerCase().endsWith('.csx')) {
      void vscode.window.showInformationMessage(
        'Forge: Open a .csx file to sync.',
      );
      return;
    }
    const root = this.deps.detector.findOwningRoot(editor.document.uri.fsPath);
    if (!root) {
      void vscode.window.showWarningMessage(
        'Forge: The active file is not inside a vNext workspace.',
      );
      return;
    }
    await this.syncCsxFile(editor.document.uri.fsPath, root, { surface: 'notification' });
  }

  private async syncAll(): Promise<void> {
    const roots = this.deps.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage(
        'Forge: No vNext workspace detected.',
      );
      return;
    }
    let totalFiles = 0;
    let totalUpdated = 0;
    const errors: Array<{ path: string; message: string }> = [];
    for (const root of roots) {
      const configStatus = await this.deps.workspaceService.readConfigStatus(root.folderPath);
      if (configStatus.status !== 'ok') continue;
      const config = configStatus.config;
      const componentsRoot = (config.paths?.componentsRoot ?? '').trim();
      if (!componentsRoot) continue;
      const csxBase = vscode.Uri.file(path.join(root.folderPath, componentsRoot));
      const csxFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(csxBase, '**/*.csx'),
        undefined,
      );
      for (const csxUri of csxFiles) {
        totalFiles += 1;
        const result = await this.syncCsxFile(csxUri.fsPath, root, { surface: 'silent' });
        if (result) {
          totalUpdated += result.updated;
          errors.push(...result.errors);
        }
      }
    }
    const errSuffix = errors.length > 0 ? ` (${errors.length} errors — see Output)` : '';
    void vscode.window.showInformationMessage(
      `Forge: Synced ${totalFiles} CSX file(s); updated ${totalUpdated} component JSON(s)${errSuffix}.`,
    );
  }

  private async toggleEnabled(next: boolean): Promise<void> {
    const target = vscode.workspace.workspaceFolders?.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await vscode.workspace
      .getConfiguration(SETTING_NAMESPACE)
      .update(SETTING_ENABLED, next, target);
    void vscode.window.showInformationMessage(
      `Forge: CSX → JSON auto-sync ${next ? 'enabled' : 'disabled'}.`,
    );
  }

  // ── Core entry: sync one CSX file ─────────────────────────────────

  private async syncCsxFile(
    csxPath: string,
    root: VnextWorkspaceRoot,
    opts: { surface: 'silent' | 'notification' },
  ): Promise<CsxSyncRunResult | null> {
    const configStatus = await this.deps.workspaceService.readConfigStatus(root.folderPath);
    if (configStatus.status !== 'ok') {
      if (opts.surface === 'notification') {
        void vscode.window.showWarningMessage(
          'Forge: vnext.config.json is missing or invalid; cannot sync.',
        );
      }
      return null;
    }
    const result = await runCsxSync(csxPath, root.folderPath, configStatus.config, {
      defaultEncoding: this.settings.defaultEncoding,
      listComponentJsonPaths,
      log: {
        info: (msg, meta) => baseLogger.info(meta ?? {}, `csx-sync ${msg}`),
        warn: (msg, meta) => baseLogger.warn(meta ?? {}, `csx-sync ${msg}`),
      },
    });
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        baseLogger.warn({ path: err.path, message: err.message }, 'csx-sync error');
      }
    }
    if (opts.surface === 'notification') {
      if (result.errors.length > 0) {
        void vscode.window.showWarningMessage(
          `Forge: Sync completed with ${result.errors.length} error(s); updated ${result.updated} JSON(s). See Output panel.`,
        );
      } else if (result.updated === 0) {
        void vscode.window.showInformationMessage(
          'Forge: No component JSON references this CSX (or content was already up to date).',
        );
      } else {
        void vscode.window.showInformationMessage(
          `Forge: Synced ${path.basename(csxPath)} → ${result.updated} component JSON(s).`,
        );
      }
    }
    return result;
  }
}

export function createCsxSyncController(deps: ControllerDeps): CsxSyncController {
  return new CsxSyncController(deps);
}
