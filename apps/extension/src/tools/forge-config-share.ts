import * as path from 'node:path';
import * as vscode from 'vscode';

import type { DataBucketService } from './data-bucket.service.js';
import {
  BUNDLE_BUCKETS,
  BUNDLE_BUCKET_LABELS,
  buildBundle,
  bucketsIn,
  collectSecretHeaderNames,
  parseBundle,
  stripHeaderValues,
  summarizeImport,
  type BundleBucket,
  type BundleSources,
  type ForgeConfigBundle,
} from './forge-config-bundle.js';
import { WORKSPACE_CONFIG_DIR } from './forge-config-locator.js';
import {
  SHAREABLE_CONFIG_FILES,
  sanitizeEnvironmentsForSharing,
  type ForgeToolsSettingsService,
  type QuickRunHeader,
} from './forge-tools-settings.js';
import { ensureGitignoreEntry } from './local-runtime/gitignore-writer.js';

/** The one file that can hold credentials, and therefore the only one ever offered for gitignoring. */
const HEADERS_GITIGNORE_ENTRY = `${WORKSPACE_CONFIG_DIR.split(path.sep).join('/')}/${SHAREABLE_CONFIG_FILES.quickRun}`;

const DEFAULT_BUNDLE_NAME = 'forge-tools-config.json';

export type HeaderWriteDecision = 'write-values' | 'write-names-only' | 'cancel';

/**
 * Confirms writing header values into the workspace, where they land in the
 * user's repository and can be committed.
 *
 * Three outcomes, not two: "names only" is the useful middle — the team gets
 * the shape of the config and supplies their own token. A boolean would have
 * forced that choice to be re-asked or silently dropped.
 *
 * Returns `'write-values'` unprompted when nothing looks sensitive. The
 * `.gitignore` offer is a separate, non-modal follow-up: a suggestion, not a
 * condition, and it names one file rather than the whole shared folder —
 * gitignoring the folder would silence exactly the sharing this exists for.
 */
export async function confirmWorkspaceHeaderWrite(
  headers: readonly QuickRunHeader[],
  workspaceRoot: string | null,
): Promise<HeaderWriteDecision> {
  const secrets = collectSecretHeaderNames(headers);
  if (secrets.length === 0) return 'write-values';

  const choice = await vscode.window.showWarningMessage(
    `${secrets.join(', ')} will be written to ${HEADERS_GITIGNORE_ENTRY} inside your repository. Anyone with repository access can read the values.`,
    { modal: true },
    'Write values',
    'Write names only',
  );
  if (choice === undefined) return 'cancel';
  if (choice === 'Write names only') return 'write-names-only';

  if (workspaceRoot) void offerGitignore(workspaceRoot);
  return 'write-values';
}

async function offerGitignore(workspaceRoot: string): Promise<void> {
  const add = await vscode.window.showInformationMessage(
    `Add ${HEADERS_GITIGNORE_ENTRY} to .gitignore?`,
    'Add',
    'Not now',
  );
  if (add !== 'Add') return;
  await ensureGitignoreEntry(
    workspaceRoot,
    HEADERS_GITIGNORE_ENTRY,
    'vNext Forge Tools — contains request header values',
  );
}

async function readSources(
  settings: ForgeToolsSettingsService,
  dataBuckets: DataBucketService,
): Promise<BundleSources> {
  const [quickRun, environments, forgeSettings, buckets] = await Promise.all([
    settings.loadQuickRunSettings(),
    settings.loadEnvironments(),
    settings.loadSettings(),
    dataBuckets.listConfigs(),
  ]);
  return {
    quickRun,
    environments,
    tenantStyle: forgeSettings.pseudoUiTenantStyle,
    dataBuckets: buckets,
  };
}

async function pickBuckets(title: string, available: readonly BundleBucket[]): Promise<BundleBucket[] | null> {
  const picked = await vscode.window.showQuickPick(
    available.map((bucket) => ({ label: BUNDLE_BUCKET_LABELS[bucket], bucket, picked: true })),
    { title, canPickMany: true, placeHolder: 'Select what to include' },
  );
  if (!picked || picked.length === 0) return null;
  return picked.map((p) => p.bucket);
}

/** `vnextForge.tools.exportConfig` */
export async function exportForgeConfig(
  settings: ForgeToolsSettingsService,
  dataBuckets: DataBucketService,
): Promise<void> {
  const sources = await readSources(settings, dataBuckets);
  const selection = await pickBuckets('Export Forge Tools Config', BUNDLE_BUCKETS);
  if (!selection) return;

  let includeSecretValues = true;
  if (selection.includes('quickRun')) {
    const secrets = collectSecretHeaderNames(sources.quickRun.globalHeaders);
    if (secrets.length > 0) {
      const choice = await vscode.window.showWarningMessage(
        `This export contains values for ${secrets.join(', ')}.`,
        { modal: true },
        'Include values',
        'Export names only',
      );
      if (choice === undefined) return;
      includeSecretValues = choice === 'Include values';
    }
  }

  const bundle = buildBundle(selection, sources, {
    includeSecretValues,
    now: new Date().toISOString(),
  });

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const target = await vscode.window.showSaveDialog({
    // `path.basename` for the same reason `MessageRouter.handleSaveFile` uses
    // it — the name must never be able to steer the write elsewhere.
    defaultUri: vscode.Uri.file(
      workspaceRoot ? path.join(workspaceRoot, path.basename(DEFAULT_BUNDLE_NAME)) : DEFAULT_BUNDLE_NAME,
    ),
    filters: { JSON: ['json'], 'All Files': ['*'] },
  });
  if (!target) return;

  await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(bundle, null, 2), 'utf-8'));
  void vscode.window.showInformationMessage(
    `Exported ${selection.length} config section(s) to ${path.basename(target.fsPath)}.`,
  );
}

/** `vnextForge.tools.importConfig` */
export async function importForgeConfig(
  settings: ForgeToolsSettingsService,
  dataBuckets: DataBucketService,
): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: true,
    openLabel: 'Import',
    filters: { JSON: ['json'], 'All Files': ['*'] },
  });
  const file = picked?.[0];
  if (!file) return;

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf-8'));
  } catch {
    void vscode.window.showErrorMessage('That file is not valid JSON.');
    return;
  }

  const { bundle, warnings, error } = parseBundle(raw);
  if (!bundle) {
    void vscode.window.showErrorMessage(error ?? 'That file could not be imported.');
    return;
  }
  for (const warning of warnings) void vscode.window.showWarningMessage(warning);

  const sources = await readSources(settings, dataBuckets);
  const changes = summarizeImport(bundle, sources);
  const confirmed = await vscode.window.showWarningMessage(
    'Import will replace these settings:',
    { modal: true, detail: changes.map((c) => `• ${c.summary}`).join('\n') },
    'Import',
  );
  if (confirmed !== 'Import') return;

  await applyBundle(bundle, settings, dataBuckets);
  void vscode.window.showInformationMessage(
    `Imported ${bucketsIn(bundle).length} config section(s).`,
  );
}

/**
 * Applies a bundle **through the service**, never by copying files.
 *
 * The settings caches are write-through and never invalidated from disk, so a
 * file-level import would stay invisible until the window reloaded. Going
 * through `saveX()` also fires the change events, which is what pushes new
 * headers into already-open Quick Run panels.
 */
async function applyBundle(
  bundle: ForgeConfigBundle,
  settings: ForgeToolsSettingsService,
  dataBuckets: DataBucketService,
): Promise<void> {
  if (bundle.quickRun) await settings.saveQuickRunSettings(bundle.quickRun);
  if (bundle.environments) await settings.saveEnvironments(bundle.environments);
  if (bundle.tenantStyle) await settings.saveTenantStyle(bundle.tenantStyle);
  for (const entry of bundle.dataBuckets ?? []) {
    await dataBuckets.saveConfig(entry.domain, entry.workflowKey, entry.config);
  }
}

/**
 * `vnextForge.tools.saveConfigToWorkspace` — the opt-in.
 *
 * Copies the currently-effective config into `.vnextstudio/forge-tools/`. From
 * the next read on, that copy wins and every later edit lands there, so the
 * team shares one setup.
 */
export async function saveForgeConfigToWorkspace(
  settings: ForgeToolsSettingsService,
  dataBuckets: DataBucketService,
): Promise<void> {
  const locator = settings.getLocator();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage('Open a folder before sharing Forge Tools config.');
    return;
  }

  const sources = await readSources(settings, dataBuckets);
  const selection = await pickBuckets('Share Forge Tools Config With This Workspace', BUNDLE_BUCKETS);
  if (!selection) return;

  let headers = sources.quickRun.globalHeaders;
  if (selection.includes('quickRun')) {
    const decision = await confirmWorkspaceHeaderWrite(headers, workspaceRoot);
    if (decision === 'cancel') return;
    if (decision === 'write-names-only') headers = stripHeaderValues(headers);
  }

  await locator.ensureWorkspaceDir();

  // Written directly rather than through `saveX()`: the files do not exist yet,
  // so `resolveWrite` would still point at the machine-local copies. Once these
  // land, every later save resolves here on its own.
  const dir = locator.workspaceDir();
  if (!dir) return;
  if (selection.includes('quickRun')) {
    await writeJson(path.join(dir, SHAREABLE_CONFIG_FILES.quickRun), {
      ...sources.quickRun,
      globalHeaders: headers,
    });
  }
  if (selection.includes('environments')) {
    await writeJson(
      path.join(dir, SHAREABLE_CONFIG_FILES.environments),
      sanitizeEnvironmentsForSharing(sources.environments),
    );
  }
  if (selection.includes('tenantStyle')) {
    await writeJson(path.join(dir, SHAREABLE_CONFIG_FILES.tenantStyle), sources.tenantStyle);
  }
  if (selection.includes('dataBuckets')) {
    for (const entry of sources.dataBuckets) {
      // Explicitly into the workspace root — `saveConfig` would still resolve
      // to the machine-local copy, since the workspace one does not exist yet.
      await dataBuckets.saveConfigInRoot(dir, entry.domain, entry.workflowKey, entry.config);
    }
  }

  // The set of files just changed, so every cached resolution is stale.
  await settings.reloadFromDisk();
  void vscode.window.showInformationMessage(
    `Forge Tools config saved to ${WORKSPACE_CONFIG_DIR}. It now takes precedence over your machine settings.`,
  );
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(JSON.stringify(data, null, 2), 'utf-8'),
  );
}
