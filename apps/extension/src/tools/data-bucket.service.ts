import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { ForgeConfigLocator } from './forge-config-locator.js';

export interface TransitionBucketEntry {
  key: string;
  headers: Record<string, string>;
  queryStrings: Record<string, unknown>;
  body: {
    key?: string;
    tags?: string[];
    attributes: Record<string, unknown>;
  };
}

/** Retry-state slot the dashboard's Retry Instance panel persists. */
export interface RetryStateBucketEntry {
  headers: Record<string, string>;
  attributes: Record<string, unknown>;
}

export interface WorkflowBucketConfig {
  key: string;
  globalHeaders: Record<string, string>;
  start: {
    headers: Record<string, string>;
    queryStrings: { sync?: boolean; version?: string };
    body: {
      key?: string;
      tags?: string[];
      /** Written by NewRunDialog; was missing from this type while the UI persisted it. */
      stage?: string;
      attributes: Record<string, unknown>;
    };
  };
  transitions: TransitionBucketEntry[];
  /** Written by InstanceDashboard's retry panel; see the note on the type sync below. */
  retryState?: RetryStateBucketEntry;
}

/** Relative directory holding every bucket, under whichever root is in play. */
const BUCKETS_DIR = 'data-buckets';

/**
 * Per-workflow Quick Run test data — the start payload, per-transition
 * attributes and headers a developer builds up while exercising a flow.
 *
 * Workspace-aware: a bucket committed under `.vnextstudio/forge-tools/data-buckets/`
 * is what the whole team gets, and it wins over the machine-local copy. See
 * `ForgeConfigLocator` for the resolution rule.
 *
 * The shape above is kept in step with `WorkflowBucketConfig` in
 * `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts` — the UI is the
 * writer, this side only round-trips JSON, so a field added there but not here
 * persists correctly and silently goes untyped. `retryState` and
 * `start.body.stage` had already drifted that way.
 */
export class DataBucketService {
  constructor(private readonly locator: ForgeConfigLocator) {}

  private relPath(domain: string, workflowKey: string): string {
    return path.join(BUCKETS_DIR, sanitizeFileName(domain), `${sanitizeFileName(workflowKey)}.json`);
  }

  async saveConfig(domain: string, workflowKey: string, config: WorkflowBucketConfig): Promise<void> {
    const { path: filePath } = await this.locator.resolveWrite(this.relPath(domain, workflowKey));
    await this.writeAt(filePath, config);
  }

  /**
   * Writes a bucket into a specific root, bypassing resolution.
   *
   * Needed by "Share config with workspace": `resolveWrite` picks the copy that
   * *already exists*, which during the very first share is still the
   * machine-local one — so going through `saveConfig` there would rewrite the
   * local file and copy nothing. Every later save resolves to the workspace on
   * its own, once these files are in place.
   */
  async saveConfigInRoot(
    root: string,
    domain: string,
    workflowKey: string,
    config: WorkflowBucketConfig,
  ): Promise<void> {
    await this.writeAt(path.join(root, this.relPath(domain, workflowKey)), config);
  }

  private async writeAt(filePath: string, config: WorkflowBucketConfig): Promise<void> {
    assertWithin(filePath, [this.locator.localDir(), this.locator.workspaceDir()]);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  async loadConfig(domain: string, workflowKey: string): Promise<WorkflowBucketConfig | null> {
    try {
      const { path: filePath } = await this.locator.resolveRead(this.relPath(domain, workflowKey));
      assertWithin(filePath, [this.locator.localDir(), this.locator.workspaceDir()]);
      const raw = await fs.readFile(filePath, 'utf-8');
      return parseWorkflowBucketConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /** Every bucket under the resolved root, for Export. */
  async listConfigs(): Promise<{ domain: string; workflowKey: string; config: WorkflowBucketConfig }[]> {
    const roots = [this.locator.workspaceDir(), this.locator.localDir()].filter(
      (dir): dir is string => dir !== null,
    );
    const seen = new Set<string>();
    const out: { domain: string; workflowKey: string; config: WorkflowBucketConfig }[] = [];

    for (const root of roots) {
      const bucketsRoot = path.join(root, BUCKETS_DIR);
      for (const domain of await readDirNames(bucketsRoot)) {
        for (const file of await readDirNames(path.join(bucketsRoot, domain))) {
          if (!file.endsWith('.json')) continue;
          const workflowKey = file.slice(0, -'.json'.length);
          // Roots are walked workspace-first, so the shared copy wins here for
          // the same reason `resolveRead` prefers it.
          const id = `${domain}/${workflowKey}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const config = await this.loadConfig(domain, workflowKey);
          if (config) out.push({ domain, workflowKey, config });
        }
      }
    }
    return out;
  }
}

/**
 * Coerces an arbitrary JSON value into a usable bucket config, or `null`.
 *
 * This was a blind `as` cast, which was survivable while the only writer was
 * our own UI writing to globalStorage. It is not survivable now: a bucket can
 * arrive via `git pull` or an import bundle, and its `globalHeaders` /
 * `headers` / `attributes` feed straight into runtime requests. Unknown fields
 * are preserved rather than stripped — the UI's type is ahead of this one (see
 * the class comment) and dropping what it wrote would lose the user's data.
 */
export function parseWorkflowBucketConfig(raw: unknown): WorkflowBucketConfig | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const start = isRecord(obj.start) ? obj.start : {};
  const startBody = isRecord(start.body) ? start.body : {};

  return {
    ...obj,
    key: typeof obj.key === 'string' ? obj.key : '',
    globalHeaders: stringRecord(obj.globalHeaders),
    start: {
      ...start,
      headers: stringRecord(start.headers),
      queryStrings: isRecord(start.queryStrings) ? start.queryStrings : {},
      body: { ...startBody, attributes: isRecord(startBody.attributes) ? startBody.attributes : {} },
    },
    transitions: Array.isArray(obj.transitions)
      ? obj.transitions.filter(isRecord).map((t) => ({
          ...t,
          key: typeof t.key === 'string' ? t.key : '',
          headers: stringRecord(t.headers),
          queryStrings: isRecord(t.queryStrings) ? t.queryStrings : {},
          body: isRecord(t.body)
            ? { ...t.body, attributes: isRecord(t.body.attributes) ? t.body.attributes : {} }
            : { attributes: {} },
        }))
      : [],
  } as WorkflowBucketConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

async function readDirNames(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Refuses a resolved path that escaped its root.
 *
 * `sanitizeFileName` strips separators but **not** `.`, so a `domain` of `..`
 * survives as a path segment — and `domain`/`workflowKey` arrive off the
 * webview wire. Harmless while everything lived in globalStorage; worth closing
 * now that the same values can steer a write into the user's own repository.
 * Mirrors the jail check in `doc-generator.ts`.
 */
function assertWithin(target: string, roots: (string | null)[]): void {
  const resolved = path.resolve(target);
  const ok = roots.some((root) => root && resolved.startsWith(path.resolve(root) + path.sep));
  if (!ok) {
    throw new Error(`Refusing to access a data bucket outside the config roots: ${target}`);
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}
