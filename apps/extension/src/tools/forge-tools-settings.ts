import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';

import type { ForgeConfigLocator, ResolvedConfigPath } from './forge-config-locator.js';
import {
  ENVIRONMENTS_FILE,
  QUICKRUN_SETTINGS_FILE,
  SETTINGS_FILE,
  TENANT_STYLE_FILE,
  parseEnvironments,
  parsePseudoUiTenantStyle,
  parseQuickRunSettings,
  parseSettings,
  writeJsonAtomic,
  type EnvironmentsConfig,
  type ForgeSettings,
  type LocalRuntimeBinding,
  type PseudoUiTenantStyleSettings,
  type QuickRunSettings,
  type RuntimeEnvironment,
  type ShareableConfigBucket,
} from './forge-settings-schema.js';

// Re-exported so every existing importer of this module keeps working.
export * from './forge-settings-schema.js';

// ── Service ──────────────────────────────────────────────────────────────────

export class ForgeToolsSettingsService implements vscode.Disposable {
  private settingsCache: ForgeSettings | undefined;
  private environmentsCache: EnvironmentsConfig | undefined;

  private readonly _onDidChangeSettings = new vscode.EventEmitter<ForgeSettings>();
  readonly onDidChangeSettings = this._onDidChangeSettings.event;

  private readonly _onDidChangeEnvironments = new vscode.EventEmitter<EnvironmentsConfig>();
  readonly onDidChangeEnvironments = this._onDidChangeEnvironments.event;

  /**
   * Fired by `saveQuickRunSettings`.
   *
   * Its absence was a real gap: an open Quick Run panel kept whatever
   * `globalHeaders` it was constructed with, so editing a header appeared to do
   * nothing until the panel was closed and reopened. `GlobalSettingsProvider`
   * worked around it by clearing its own caches by hand.
   */
  private readonly _onDidChangeQuickRunSettings = new vscode.EventEmitter<QuickRunSettings>();
  readonly onDidChangeQuickRunSettings = this._onDidChangeQuickRunSettings.event;

  constructor(private readonly locator: ForgeConfigLocator) {}

  dispose(): void {
    this._onDidChangeSettings.dispose();
    this._onDidChangeEnvironments.dispose();
    this._onDidChangeQuickRunSettings.dispose();
  }

  /**
   * Re-resolves every bucket from disk and fires the change events.
   *
   * Needed whenever the *set of files* could have changed underneath us rather
   * than their contents: a workspace-folder switch (a different
   * `.vnextstudio/forge-tools/`), or an import that just created one. The caches
   * are otherwise write-through and never invalidated, so without this a
   * newly-adopted workspace config stays invisible until the window reloads.
   *
   * **Assign after parse — never clear then await.** `DesignerPanel.buildWebviewConfig`
   * reads `getCachedQuickRunSettings()` synchronously and silently omits
   * `globalHeaders` when it returns `undefined`; a panel built during the gap
   * of a clear-then-load would come up with no headers and no error. Each cache
   * below is replaced in a single assignment once its value is fully parsed.
   */
  async reloadFromDisk(): Promise<void> {
    const [rawPersonal, rawTenant, rawEnvironments, rawQuickRun] = await Promise.all([
      this.readLocalJsonFile(SETTINGS_FILE),
      this.readJsonFile(TENANT_STYLE_FILE),
      this.readJsonFile(ENVIRONMENTS_FILE),
      this.readJsonFile(QUICKRUN_SETTINGS_FILE),
    ]);

    const personal = parseSettings(rawPersonal);
    const tenantStyle =
      rawTenant == null ? personal.pseudoUiTenantStyle : parsePseudoUiTenantStyle(rawTenant);
    const settings: ForgeSettings = { ...personal, pseudoUiTenantStyle: tenantStyle };
    const environments = parseEnvironments(rawEnvironments);
    const quickRun = parseQuickRunSettings(rawQuickRun);

    this.tenantStyleCache = tenantStyle;
    this.settingsCache = settings;
    this.environmentsCache = environments;
    this.quickRunCache = quickRun;

    this._onDidChangeSettings.fire(settings);
    this._onDidChangeEnvironments.fire(environments);
    this._onDidChangeQuickRunSettings.fire(quickRun);
  }

  /** Which copy of each shareable bucket is currently in play — drives the Config Source tree. */
  async resolveSources(): Promise<Record<ShareableConfigBucket, ResolvedConfigPath>> {
    const [quickRun, environments, tenantStyle] = await Promise.all([
      this.locator.resolveRead(QUICKRUN_SETTINGS_FILE),
      this.locator.resolveRead(ENVIRONMENTS_FILE),
      this.locator.resolveRead(TENANT_STYLE_FILE),
    ]);
    return { quickRun, environments, tenantStyle };
  }

  getLocator(): ForgeConfigLocator {
    return this.locator;
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  /**
   * Returns the in-memory cached settings synchronously. Returns `undefined`
   * if `loadSettings()` has not been called yet. Used by `DesignerPanel` to
   * inject config into the webview HTML synchronously.
   */
  getCachedSettings(): ForgeSettings | undefined {
    return this.settingsCache;
  }

  private tenantStyleCache: PseudoUiTenantStyleSettings | undefined;

  /**
   * Composes one `ForgeSettings` out of two files.
   *
   * `canvas` / `themeMode` / `autoSaveEnabled` are personal preferences and are
   * read **only** from the machine-local `forge-settings.json` — they must never
   * ride along in a shared workspace file. `pseudoUiTenantStyle` describes a
   * tenant, not a person, so it comes from the resolved `tenant-style.json`
   * (workspace-first).
   *
   * Back-compat: an install predating the split has no `tenant-style.json` at
   * all, and its tenant style still sits inside `forge-settings.json`. That
   * legacy value is the last fallback, and it is left in the file untouched —
   * there is no migration step to fail, and the first save simply starts writing
   * the new file instead.
   */
  async loadSettings(): Promise<ForgeSettings> {
    if (this.settingsCache) return this.settingsCache;
    const raw = await this.readLocalJsonFile(SETTINGS_FILE);
    const personal = parseSettings(raw);
    this.settingsCache = {
      ...personal,
      pseudoUiTenantStyle: await this.loadTenantStyle(personal.pseudoUiTenantStyle),
    };
    return this.settingsCache;
  }

  private async loadTenantStyle(
    legacyFallback: PseudoUiTenantStyleSettings,
  ): Promise<PseudoUiTenantStyleSettings> {
    if (this.tenantStyleCache) return this.tenantStyleCache;
    const raw = await this.readJsonFile(TENANT_STYLE_FILE);
    this.tenantStyleCache = raw == null ? { ...legacyFallback } : parsePseudoUiTenantStyle(raw);
    return this.tenantStyleCache;
  }

  async saveSettings(patch: Partial<ForgeSettings>): Promise<ForgeSettings> {
    const current = await this.loadSettings();
    const personal: Omit<ForgeSettings, 'pseudoUiTenantStyle'> = {
      canvas: patch.canvas ? { ...current.canvas, ...patch.canvas } : current.canvas,
      themeMode: patch.themeMode ?? current.themeMode,
      autoSaveEnabled: patch.autoSaveEnabled ?? current.autoSaveEnabled,
    };
    const tenantStyle = patch.pseudoUiTenantStyle
      ? parsePseudoUiTenantStyle({ ...current.pseudoUiTenantStyle, ...patch.pseudoUiTenantStyle })
      : current.pseudoUiTenantStyle;

    // Personal keys always land locally; the tenant style follows the resolved
    // source, so a workspace-shared stylesheet stays shared once adopted.
    await this.writeLocalJsonFile(SETTINGS_FILE, personal);
    if (patch.pseudoUiTenantStyle) {
      await this.writeJsonFile(TENANT_STYLE_FILE, tenantStyle);
      this.tenantStyleCache = tenantStyle;
    }

    const merged: ForgeSettings = { ...personal, pseudoUiTenantStyle: tenantStyle };
    this.settingsCache = merged;
    this._onDidChangeSettings.fire(merged);
    return merged;
  }

  /** Replaces the tenant style wholesale — used by Import. */
  async saveTenantStyle(style: PseudoUiTenantStyleSettings): Promise<ForgeSettings> {
    return this.saveSettings({ pseudoUiTenantStyle: parsePseudoUiTenantStyle(style) });
  }

  // ── Environments ─────────────────────────────────────────────────────────

  async loadEnvironments(): Promise<EnvironmentsConfig> {
    if (this.environmentsCache) return this.environmentsCache;
    const raw = await this.readJsonFile(ENVIRONMENTS_FILE);
    this.environmentsCache = parseEnvironments(raw);
    return this.environmentsCache;
  }

  async saveEnvironments(data: EnvironmentsConfig): Promise<void> {
    const validated = parseEnvironments(data);
    await this.writeJsonFile(ENVIRONMENTS_FILE, validated);
    this.environmentsCache = validated;
    this._onDidChangeEnvironments.fire(validated);
  }

  async getActiveEnvironment(): Promise<RuntimeEnvironment | null> {
    const config = await this.loadEnvironments();
    if (!config.activeEnvironmentId) return null;
    return config.environments.find((e) => e.id === config.activeEnvironmentId) ?? null;
  }

  /**
   * Returns the base URLs of all currently cached environments.
   * Returns an empty array if `loadEnvironments()` has not been called yet
   * or if no environments are configured.
   *
   * Intended for use as a live callback in `RuntimeProxyService` so the
   * proxy's allowlist automatically reflects Forge Tools environments without
   * requiring a service restart.
   */
  getCachedEnvironmentUrls(): string[] {
    return this.environmentsCache?.environments.map((e) => e.baseUrl) ?? [];
  }

  async addEnvironment(
    name: string,
    baseUrl: string,
    dbName?: string,
    binding?: LocalRuntimeBinding,
  ): Promise<RuntimeEnvironment> {
    const config = await this.loadEnvironments();
    const env: RuntimeEnvironment = {
      id: crypto.randomUUID(),
      name,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      ...(dbName ? { dbName } : {}),
      ...(binding ? { kind: 'local-docker' as const, local: binding } : { kind: 'remote' as const }),
    };
    config.environments.push(env);
    config.activeEnvironmentId ??= env.id;
    await this.saveEnvironments(config);
    return env;
  }

  /**
   * `dbName` and `local` exist so that provisioning an environment that was
   * added earlier reaches the same stored state as provisioning it through
   * Add — otherwise the two paths persist different things.
   */
  async updateEnvironment(
    id: string,
    patch: {
      name?: string;
      baseUrl?: string;
      dbName?: string;
      local?: LocalRuntimeBinding;
    },
  ): Promise<void> {
    const config = await this.loadEnvironments();
    const env = config.environments.find((e) => e.id === id);
    if (!env) return;
    if (patch.name !== undefined) env.name = patch.name;
    if (patch.baseUrl !== undefined) env.baseUrl = patch.baseUrl.replace(/\/+$/, '');
    if (patch.dbName !== undefined) env.dbName = patch.dbName;
    if (patch.local !== undefined) {
      // `kind` is set with it: parseEnvironments only keeps `local` when the
      // kind says local-docker, so writing the binding alone would drop it.
      env.kind = 'local-docker';
      env.local = patch.local;
    }
    await this.saveEnvironments(config);
  }

  async removeEnvironment(id: string): Promise<void> {
    const config = await this.loadEnvironments();
    config.environments = config.environments.filter((e) => e.id !== id);
    if (config.activeEnvironmentId === id) {
      config.activeEnvironmentId = config.environments[0]?.id ?? null;
    }
    await this.saveEnvironments(config);
  }

  async setActiveEnvironment(id: string | null): Promise<void> {
    const config = await this.loadEnvironments();
    if (id !== null && !config.environments.some((e) => e.id === id)) return;
    config.activeEnvironmentId = id;
    await this.saveEnvironments(config);
  }

  static generateId(): string {
    return crypto.randomUUID();
  }

  // ── QuickRun Settings ───────────────────────────────────────────────────

  private quickRunCache: QuickRunSettings | undefined;

  async loadQuickRunSettings(): Promise<QuickRunSettings> {
    if (this.quickRunCache) return this.quickRunCache;
    const raw = await this.readJsonFile(QUICKRUN_SETTINGS_FILE);
    this.quickRunCache = parseQuickRunSettings(raw);
    return this.quickRunCache;
  }

  /**
   * Returns the in-memory cached Quick Run settings synchronously. Returns
   * `undefined` if `loadQuickRunSettings()` has not been called yet — `activate()`
   * pre-loads it at startup for exactly this reason, so `DesignerPanel` can
   * inject `globalHeaders` into `window.__VNEXT_CONFIG__` without making
   * `buildWebviewConfig` async.
   */
  getCachedQuickRunSettings(): QuickRunSettings | undefined {
    return this.quickRunCache;
  }

  async saveQuickRunSettings(patch: Partial<QuickRunSettings>): Promise<QuickRunSettings> {
    const current = await this.loadQuickRunSettings();
    const merged: QuickRunSettings = {
      globalHeaders: patch.globalHeaders ?? current.globalHeaders,
      polling: patch.polling ? { ...current.polling, ...patch.polling } : current.polling,
    };
    await this.writeJsonFile(QUICKRUN_SETTINGS_FILE, merged);
    this.quickRunCache = merged;
    this._onDidChangeQuickRunSettings.fire(merged);
    return merged;
  }

  // ── File I/O ─────────────────────────────────────────────────────────────

  /**
   * Reads whichever copy of `fileName` is in play — the workspace one when it
   * exists, else the machine-local one. Returns `null` on a missing file or
   * malformed JSON, exactly as before; every caller funnels the result through
   * a `parseX()` that fills in defaults, so a hand-edited file can never break
   * activation.
   */
  private async readJsonFile(fileName: string): Promise<unknown> {
    try {
      const { path: filePath } = await this.locator.resolveRead(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Writes to whichever copy is in play — see `ForgeConfigLocator.resolveWrite`
   * for why a save must land on the same file the read came from.
   *
   * Still atomic (tmp + rename). `mkdir` targets the *resolved* file's own
   * directory rather than a fixed storage dir, since that may now be inside the
   * workspace.
   */
  private async writeJsonFile(fileName: string, data: unknown): Promise<void> {
    const { path: filePath } = await this.locator.resolveWrite(fileName);
    await writeJsonAtomic(filePath, data);
  }

  /**
   * Machine-local read, bypassing workspace resolution.
   *
   * `forge-settings.json` holds personal preferences (`themeMode`,
   * `autoSaveEnabled`, canvas layout) and is deliberately never shared — see
   * `loadSettings`. Routing it through `readJsonFile` would let a stray
   * workspace copy override another developer's theme.
   */
  private async readLocalJsonFile(fileName: string): Promise<unknown> {
    try {
      const content = await fs.readFile(this.locator.localPath(fileName), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async writeLocalJsonFile(fileName: string, data: unknown): Promise<void> {
    await writeJsonAtomic(this.locator.localPath(fileName), data);
  }
}
