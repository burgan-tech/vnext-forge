import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ── Canvas settings types (mirrored from designer-ui CanvasViewSettingsContext) ──

export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'DOWN' | 'RIGHT';
export type EdgePathStyle = 'smoothstep' | 'bezier' | 'straight';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface CanvasSettings {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  edgePathStyle: EdgePathStyle;
}

export interface ForgeSettings {
  canvas: CanvasSettings;
  themeMode: ThemeMode;
}

// ── Environment types ────────────────────────────────────────────────────────

export interface RuntimeEnvironment {
  id: string;
  name: string;
  baseUrl: string;
}

export interface EnvironmentsConfig {
  version: number;
  environments: RuntimeEnvironment[];
  activeEnvironmentId: string | null;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ForgeSettings = {
  canvas: {
    algorithm: 'dagre',
    direction: 'DOWN',
    edgePathStyle: 'smoothstep',
  },
  themeMode: 'system',
};

const DEFAULT_ENVIRONMENTS: EnvironmentsConfig = {
  version: 1,
  environments: [],
  activeEnvironmentId: null,
};

// ── QuickRun types ───────────────────────────────────────────────────────────

export interface QuickRunHeader {
  name: string;
  value: string;
  isSecret?: boolean;
}

export interface QuickRunPollingConfig {
  retryCount: number;
  intervalMs: number;
}

export interface QuickRunSettings {
  globalHeaders: QuickRunHeader[];
  polling: QuickRunPollingConfig;
}

const DEFAULT_QUICKRUN_SETTINGS: QuickRunSettings = {
  globalHeaders: [],
  polling: {
    retryCount: 12,
    intervalMs: 500,
  },
};

const SETTINGS_FILE = 'forge-settings.json';
const ENVIRONMENTS_FILE = 'environments.json';
const QUICKRUN_SETTINGS_FILE = 'quickrun-settings.json';

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:']);

function isAllowedBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_ALGORITHMS: readonly LayoutAlgorithm[] = ['dagre', 'elk'];
const VALID_DIRECTIONS: readonly LayoutDirection[] = ['DOWN', 'RIGHT'];
const VALID_EDGE_STYLES: readonly EdgePathStyle[] = ['smoothstep', 'bezier', 'straight'];
const VALID_THEMES: readonly ThemeMode[] = ['dark', 'light', 'system'];

function isValidAlgorithm(v: unknown): v is LayoutAlgorithm {
  return typeof v === 'string' && (VALID_ALGORITHMS as readonly string[]).includes(v);
}
function isValidDirection(v: unknown): v is LayoutDirection {
  return typeof v === 'string' && (VALID_DIRECTIONS as readonly string[]).includes(v);
}
function isValidEdgeStyle(v: unknown): v is EdgePathStyle {
  return typeof v === 'string' && (VALID_EDGE_STYLES as readonly string[]).includes(v);
}
function isValidTheme(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (VALID_THEMES as readonly string[]).includes(v);
}

function parseSettings(raw: unknown): ForgeSettings {
  const defaults = DEFAULT_SETTINGS;
  if (raw == null || typeof raw !== 'object') return { ...defaults };
  const obj = raw as Record<string, unknown>;

  const canvas = typeof obj.canvas === 'object' && obj.canvas != null
    ? obj.canvas as Record<string, unknown>
    : {};

  return {
    canvas: {
      algorithm: isValidAlgorithm(canvas.algorithm) ? canvas.algorithm : defaults.canvas.algorithm,
      direction: isValidDirection(canvas.direction) ? canvas.direction : defaults.canvas.direction,
      edgePathStyle: isValidEdgeStyle(canvas.edgePathStyle) ? canvas.edgePathStyle : defaults.canvas.edgePathStyle,
    },
    themeMode: isValidTheme(obj.themeMode) ? obj.themeMode : defaults.themeMode,
  };
}

function parseQuickRunSettings(raw: unknown): QuickRunSettings {
  if (raw == null || typeof raw !== 'object') {
    return { globalHeaders: [], polling: { ...DEFAULT_QUICKRUN_SETTINGS.polling } };
  }
  const obj = raw as Record<string, unknown>;

  const globalHeaders: QuickRunHeader[] = [];
  if (Array.isArray(obj.globalHeaders)) {
    for (const item of obj.globalHeaders) {
      if (
        item != null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).value === 'string'
      ) {
        globalHeaders.push({
          name: (item as Record<string, unknown>).name as string,
          value: (item as Record<string, unknown>).value as string,
          isSecret: (item as Record<string, unknown>).isSecret === true,
        });
      }
    }
  }

  const polling = { ...DEFAULT_QUICKRUN_SETTINGS.polling };
  if (typeof obj.polling === 'object' && obj.polling != null) {
    const p = obj.polling as Record<string, unknown>;
    if (typeof p.retryCount === 'number' && p.retryCount > 0) {
      polling.retryCount = p.retryCount;
    }
    if (typeof p.intervalMs === 'number' && p.intervalMs > 0) {
      polling.intervalMs = p.intervalMs;
    }
  }

  return { globalHeaders, polling };
}

function parseEnvironments(raw: unknown): EnvironmentsConfig {
  if (raw == null || typeof raw !== 'object') return { ...DEFAULT_ENVIRONMENTS, environments: [] };
  const obj = raw as Record<string, unknown>;

  const environments: RuntimeEnvironment[] = [];
  if (Array.isArray(obj.environments)) {
    for (const item of obj.environments) {
      if (
        item != null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).baseUrl === 'string'
      ) {
        const rawUrl = ((item as Record<string, unknown>).baseUrl as string).replace(/\/+$/, '');
        if (!isAllowedBaseUrl(rawUrl)) continue;
        environments.push({
          id: (item as Record<string, unknown>).id as string,
          name: (item as Record<string, unknown>).name as string,
          baseUrl: rawUrl,
        });
      }
    }
  }

  const activeEnvironmentId =
    typeof obj.activeEnvironmentId === 'string' &&
    environments.some((e) => e.id === obj.activeEnvironmentId)
      ? (obj.activeEnvironmentId as string)
      : null;

  return { version: 1, environments, activeEnvironmentId };
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ForgeToolsSettingsService implements vscode.Disposable {
  private readonly storageDir: string;

  private settingsCache: ForgeSettings | undefined;
  private environmentsCache: EnvironmentsConfig | undefined;

  private readonly _onDidChangeSettings = new vscode.EventEmitter<ForgeSettings>();
  readonly onDidChangeSettings = this._onDidChangeSettings.event;

  private readonly _onDidChangeEnvironments = new vscode.EventEmitter<EnvironmentsConfig>();
  readonly onDidChangeEnvironments = this._onDidChangeEnvironments.event;

  constructor(globalStorageUri: vscode.Uri) {
    this.storageDir = globalStorageUri.fsPath;
  }

  dispose(): void {
    this._onDidChangeSettings.dispose();
    this._onDidChangeEnvironments.dispose();
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

  async loadSettings(): Promise<ForgeSettings> {
    if (this.settingsCache) return this.settingsCache;
    const raw = await this.readJsonFile(SETTINGS_FILE);
    this.settingsCache = parseSettings(raw);
    return this.settingsCache;
  }

  async saveSettings(patch: Partial<ForgeSettings>): Promise<ForgeSettings> {
    const current = await this.loadSettings();
    const merged: ForgeSettings = {
      canvas: patch.canvas ? { ...current.canvas, ...patch.canvas } : current.canvas,
      themeMode: patch.themeMode ?? current.themeMode,
    };
    await this.writeJsonFile(SETTINGS_FILE, merged);
    this.settingsCache = merged;
    this._onDidChangeSettings.fire(merged);
    return merged;
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

  async addEnvironment(name: string, baseUrl: string): Promise<RuntimeEnvironment> {
    const config = await this.loadEnvironments();
    const env: RuntimeEnvironment = {
      id: crypto.randomUUID(),
      name,
      baseUrl: baseUrl.replace(/\/+$/, ''),
    };
    config.environments.push(env);
    if (config.activeEnvironmentId === null) {
      config.activeEnvironmentId = env.id;
    }
    await this.saveEnvironments(config);
    return env;
  }

  async updateEnvironment(id: string, patch: { name?: string; baseUrl?: string }): Promise<void> {
    const config = await this.loadEnvironments();
    const env = config.environments.find((e) => e.id === id);
    if (!env) return;
    if (patch.name !== undefined) env.name = patch.name;
    if (patch.baseUrl !== undefined) env.baseUrl = patch.baseUrl.replace(/\/+$/, '');
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

  async saveQuickRunSettings(patch: Partial<QuickRunSettings>): Promise<QuickRunSettings> {
    const current = await this.loadQuickRunSettings();
    const merged: QuickRunSettings = {
      globalHeaders: patch.globalHeaders ?? current.globalHeaders,
      polling: patch.polling ? { ...current.polling, ...patch.polling } : current.polling,
    };
    await this.writeJsonFile(QUICKRUN_SETTINGS_FILE, merged);
    this.quickRunCache = merged;
    return merged;
  }

  // ── File I/O ─────────────────────────────────────────────────────────────

  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  private async readJsonFile(fileName: string): Promise<unknown> {
    try {
      const filePath = path.join(this.storageDir, fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async writeJsonFile(fileName: string, data: unknown): Promise<void> {
    await this.ensureStorageDir();
    const filePath = path.join(this.storageDir, fileName);
    const tmpPath = `${filePath}.${Date.now()}.tmp`;
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  }
}
