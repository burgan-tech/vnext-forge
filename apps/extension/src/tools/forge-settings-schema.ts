/**
 * Types, defaults, validators and pure helpers for the Forge Tools config files.
 *
 * Split out of `forge-tools-settings.ts` so it carries **no `vscode` import**:
 * the service there needs `EventEmitter`/`Disposable`, which makes it
 * unloadable outside the extension host, and these validators are the part
 * worth testing — they are what stands between a hand-edited or `git pull`-ed
 * config file and the runtime requests it configures. `forge-tools-settings.ts`
 * re-exports everything here, so no call site had to change.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';


// ── Canvas settings types (mirrored from designer-ui CanvasViewSettingsContext) ──

export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'DOWN' | 'RIGHT';
export type EdgePathStyle = 'smoothstep' | 'bezier' | 'straight';
export type ThemeMode = 'dark' | 'light' | 'system';
export type PseudoUiTenantStyleSource = 'url' | 'localFile';

export interface CanvasSettings {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  edgePathStyle: EdgePathStyle;
}

export interface ForgeSettings {
  canvas: CanvasSettings;
  themeMode: ThemeMode;
  autoSaveEnabled: boolean;
  pseudoUiTenantStyle: PseudoUiTenantStyleSettings;
}

export interface PseudoUiTenantStyleSettings {
  enabled: boolean;
  sourceType: PseudoUiTenantStyleSource;
  value: string;
}

// ── Environment types ────────────────────────────────────────────────────────

export type EnvironmentKind = 'remote' | 'local-docker';

/** Ports a managed local domain occupies on the host. */
export interface LocalRuntimePorts {
  app: number;
  execution: number;
  inbox: number;
  outbox: number;
  init: number;
}

/** Everything needed to drive a managed local runtime after it is provisioned. */
export interface LocalRuntimeBinding {
  /** Domain from the workspace's vnext.config.json. */
  domain: string;
  portOffset: number;
  /** Absolute path of the clone: <workspacePath>/.vnext-runtime */
  runtimePath: string;
  /** Workspace root that owns this runtime. */
  workspacePath: string;
  ports: LocalRuntimePorts;
}

export interface RuntimeEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  dbName?: string;
  /** Undefined means 'remote' — keeps pre-existing environments.json valid. */
  kind?: EnvironmentKind;
  /** Present only when kind === 'local-docker'. */
  local?: LocalRuntimeBinding;
}

export interface EnvironmentsConfig {
  version: number;
  environments: RuntimeEnvironment[];
  activeEnvironmentId: string | null;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: ForgeSettings = {
  canvas: {
    algorithm: 'dagre',
    direction: 'DOWN',
    edgePathStyle: 'smoothstep',
  },
  themeMode: 'system',
  autoSaveEnabled: false,
  pseudoUiTenantStyle: {
    enabled: false,
    sourceType: 'url',
    value: '',
  },
};

export const DEFAULT_ENVIRONMENTS: EnvironmentsConfig = {
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

export const DEFAULT_QUICKRUN_SETTINGS: QuickRunSettings = {
  globalHeaders: [],
  polling: {
    retryCount: 15,
    intervalMs: 4000,
  },
};

export const SETTINGS_FILE = 'forge-settings.json';
export const ENVIRONMENTS_FILE = 'environments.json';
export const QUICKRUN_SETTINGS_FILE = 'quickrun-settings.json';
/**
 * The shareable slice of `forge-settings.json`, in its own file.
 *
 * `forge-settings.json` mixes team-shareable (`pseudoUiTenantStyle` — a tenant's
 * brand stylesheet, the same for everyone working on that tenant) with strictly
 * personal (`canvas`, `themeMode`, `autoSaveEnabled`). Since resolution is
 * per-file, the shareable part needs a file of its own; the rest never leaves
 * the machine. See `loadSettings` for how the two are composed back together.
 */
export const TENANT_STYLE_FILE = 'tenant-style.json';

/** Config files that can be shared through the workspace. */
export const SHAREABLE_CONFIG_FILES = {
  quickRun: QUICKRUN_SETTINGS_FILE,
  environments: ENVIRONMENTS_FILE,
  tenantStyle: TENANT_STYLE_FILE,
} as const;

export type ShareableConfigBucket = keyof typeof SHAREABLE_CONFIG_FILES;

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:']);

export function isAllowedBaseUrl(url: string): boolean {
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

export function parsePseudoUiTenantStyle(raw: unknown): PseudoUiTenantStyleSettings {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS.pseudoUiTenantStyle };
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_SETTINGS.pseudoUiTenantStyle.enabled,
    sourceType: obj.sourceType === 'localFile' ? 'localFile' : 'url',
    value: typeof obj.value === 'string' ? obj.value : '',
  };
}

export function parseSettings(raw: unknown): ForgeSettings {
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
    autoSaveEnabled: typeof obj.autoSaveEnabled === 'boolean' ? obj.autoSaveEnabled : defaults.autoSaveEnabled,
    pseudoUiTenantStyle: parsePseudoUiTenantStyle(obj.pseudoUiTenantStyle),
  };
}

export function parseQuickRunSettings(raw: unknown): QuickRunSettings {
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

function parsePositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function parseLocalRuntimePorts(raw: unknown): LocalRuntimePorts | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const app = parsePositiveInt(o.app);
  const execution = parsePositiveInt(o.execution);
  const inbox = parsePositiveInt(o.inbox);
  const outbox = parsePositiveInt(o.outbox);
  const init = parsePositiveInt(o.init);
  if (app === null || execution === null || inbox === null || outbox === null || init === null) {
    return null;
  }
  return { app, execution, inbox, outbox, init };
}

/**
 * Returns null when the binding is unusable. The caller then downgrades the
 * environment to 'remote' rather than dropping it: the base URL still works,
 * only the lifecycle actions go away.
 */
function parseLocalRuntimeBinding(raw: unknown): LocalRuntimeBinding | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ports = parseLocalRuntimePorts(o.ports);
  if (
    typeof o.domain !== 'string' || o.domain.length === 0 ||
    typeof o.runtimePath !== 'string' || o.runtimePath.length === 0 ||
    typeof o.workspacePath !== 'string' || o.workspacePath.length === 0 ||
    typeof o.portOffset !== 'number' || !Number.isInteger(o.portOffset) || o.portOffset < 0 ||
    ports === null
  ) {
    return null;
  }
  return {
    domain: o.domain,
    portOffset: o.portOffset,
    runtimePath: o.runtimePath,
    workspacePath: o.workspacePath,
    ports,
  };
}

export function parseEnvironments(raw: unknown): EnvironmentsConfig {
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
        const rec = item as Record<string, unknown>;
        const local = rec.kind === 'local-docker' ? parseLocalRuntimeBinding(rec.local) : null;
        environments.push({
          id: rec.id as string,
          name: rec.name as string,
          baseUrl: rawUrl,
          ...(typeof rec.dbName === 'string' && rec.dbName.length > 0 ? { dbName: rec.dbName } : {}),
          // A malformed binding downgrades the entry to remote instead of
          // dropping it — the URL is still usable.
          ...(local ? { kind: 'local-docker' as const, local } : { kind: 'remote' as const }),
        });
      }
    }
  }

  const activeEnvironmentId =
    typeof obj.activeEnvironmentId === 'string' &&
    environments.some((e) => e.id === obj.activeEnvironmentId)
      ? obj.activeEnvironmentId
      : null;

  return { version: 1, environments, activeEnvironmentId };
}

/**
 * Strips the machine-specific parts of an environments config before it leaves
 * this machine — written to the workspace, or put in an export bundle.
 *
 * Two things do not survive the trip:
 *
 * - `local.runtimePath` / `local.workspacePath` are absolute paths on *this*
 *   disk (`<workspacePath>/.vnext-runtime`). A `local-docker` entry is therefore
 *   downgraded to `remote`, which `parseEnvironments` already does for a
 *   malformed binding — the teammate keeps a usable URL instead of a broken
 *   container binding.
 * - `activeEnvironmentId` is a personal pointer that changes every time anyone
 *   switches environment. Committed, it would repoint the whole team's runtime
 *   on someone else's whim and churn the file on every switch.
 */
export function sanitizeEnvironmentsForSharing(config: EnvironmentsConfig): EnvironmentsConfig {
  return {
    version: config.version,
    activeEnvironmentId: null,
    environments: config.environments.map((env) => {
      const shared: RuntimeEnvironment = {
        id: env.id,
        name: env.name,
        baseUrl: env.baseUrl,
        ...(env.dbName === undefined ? {} : { dbName: env.dbName }),
      };
      return env.kind === undefined ? shared : { ...shared, kind: 'remote' as const };
    }),
  };
}

/**
 * Atomic JSON write: tmp file then rename, so a crash mid-write can never leave
 * a half-written config behind. The containing directory is created on demand —
 * the target may be the workspace folder, which need not exist yet.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

