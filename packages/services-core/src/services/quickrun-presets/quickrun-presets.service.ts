import path from 'node:path';

import type { LoggerAdapter } from '../../adapters/logger.js';
import type { FileSystemAdapter } from '../../adapters/file-system.js';

import {
  presetEntrySchema,
  type PresetEntry,
  type PresetsDeleteParams,
  type PresetsDeleteResult,
  type PresetsGetParams,
  type PresetsGetResult,
  type PresetsListParams,
  type PresetsListResult,
  type PresetsSaveParams,
  type PresetsSaveResult,
} from './quickrun-presets-schemas.js';

/**
 * QuickRun preset CRUD — named start-payload templates per workflow.
 *
 * Storage layout:
 *
 *   <root>/<projectId>/<workflowKey>/<slug>.json
 *
 * `<root>` is composition-injected (apps/server uses
 * `${userDataDir}/quickrun-presets`). Both `projectId` and `workflowKey`
 * are sanitized into filesystem-safe slugs so weird characters in either
 * one can't break the path.
 *
 * `lastUsedAt` is updated on `get()` so the UI can sort by recency without
 * a separate "track usage" call.
 */

export interface QuickRunPresetsServiceDeps {
  fs: FileSystemAdapter;
  logger: LoggerAdapter;
  /** Absolute root for preset files (no trailing slash). */
  presetsRoot: string;
}

export interface QuickRunPresetsService {
  list(params: PresetsListParams): Promise<PresetsListResult>;
  get(params: PresetsGetParams): Promise<PresetsGetResult>;
  save(params: PresetsSaveParams): Promise<PresetsSaveResult>;
  delete(params: PresetsDeleteParams): Promise<PresetsDeleteResult>;
}

function sanitizeSegment(value: string): string {
  // Allow `[A-Za-z0-9._-]`, replace anything else with `_`. Length cap at
  // 100 chars so unusually long ids don't blow PATH_MAX on Windows.
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}

function slugifyName(name: string): string {
  // "Happy Path" → "happy-path"; collapses runs of separators; trims edges.
  const trimmed = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return trimmed.length > 0 ? trimmed.slice(0, 80) : 'untitled';
}

export function createQuickRunPresetsService(
  deps: QuickRunPresetsServiceDeps,
): QuickRunPresetsService {
  const { fs, logger, presetsRoot } = deps;

  function workflowDir(projectId: string, workflowKey: string): string {
    return path.join(presetsRoot, sanitizeSegment(projectId), sanitizeSegment(workflowKey));
  }

  function presetFile(projectId: string, workflowKey: string, presetId: string): string {
    return path.join(workflowDir(projectId, workflowKey), `${sanitizeSegment(presetId)}.json`);
  }

  async function readPresetFile(absPath: string): Promise<PresetEntry | null> {
    try {
      const raw = await fs.readFile(absPath);
      const parsed = JSON.parse(raw);
      const validated = presetEntrySchema.safeParse(parsed);
      return validated.success ? validated.data : null;
    } catch {
      return null;
    }
  }

  async function ensureUniqueId(
    projectId: string,
    workflowKey: string,
    base: string,
  ): Promise<string> {
    let attempt = base;
    let n = 2;
    while (await fs.exists(presetFile(projectId, workflowKey, attempt))) {
      attempt = `${base}-${n}`;
      n += 1;
      if (n > 200) break; // sanity stop; user clearly has too many "Untitled"
    }
    return attempt;
  }

  async function list(params: PresetsListParams): Promise<PresetsListResult> {
    const dir = workflowDir(params.projectId, params.workflowKey);
    if (!(await fs.exists(dir))) {
      return { presets: [] };
    }
    const entries = await fs.readDir(dir);
    const out: PresetEntry[] = [];
    for (const entry of entries) {
      if (!entry.isFile) continue;
      if (!entry.name.toLowerCase().endsWith('.json')) continue;
      const preset = await readPresetFile(path.join(dir, entry.name));
      if (preset) out.push(preset);
    }
    // Most-recently-used first (falls back to createdAt for unused).
    out.sort((a, b) => {
      const ta = a.lastUsedAt ?? a.createdAt;
      const tb = b.lastUsedAt ?? b.createdAt;
      return tb.localeCompare(ta);
    });
    return { presets: out };
  }

  async function get(params: PresetsGetParams): Promise<PresetsGetResult> {
    const file = presetFile(params.projectId, params.workflowKey, params.presetId);
    const preset = await readPresetFile(file);
    if (!preset) return { preset: null };

    // Touch lastUsedAt — best-effort, ignore failures (e.g. read-only FS).
    try {
      const updated: PresetEntry = { ...preset, lastUsedAt: new Date().toISOString() };
      await fs.writeFile(file, `${JSON.stringify(updated, null, 2)}\n`);
      return { preset: updated };
    } catch (err) {
      logger.warn?.(
        { err, file, code: 'QUICKRUN_PRESETS_TOUCH_FAILED' },
        'Failed to update preset lastUsedAt (non-fatal).',
      );
      return { preset };
    }
  }

  async function save(params: PresetsSaveParams): Promise<PresetsSaveResult> {
    const dir = workflowDir(params.projectId, params.workflowKey);
    await fs.mkdir(dir, { recursive: true });

    let id: string;
    let created: boolean;
    if (params.presetId) {
      // In-place update — caller drove the slug.
      id = sanitizeSegment(params.presetId);
      created = !(await fs.exists(presetFile(params.projectId, params.workflowKey, id)));
    } else {
      const baseSlug = slugifyName(params.data.name);
      id = await ensureUniqueId(params.projectId, params.workflowKey, baseSlug);
      created = true;
    }

    const now = new Date().toISOString();
    const previous = !created
      ? await readPresetFile(presetFile(params.projectId, params.workflowKey, id))
      : null;
    const preset: PresetEntry = {
      id,
      name: params.data.name,
      ...(params.data.description ? { description: params.data.description } : {}),
      payload: params.data.payload,
      createdAt: previous?.createdAt ?? now,
      lastUsedAt: now,
    };
    await fs.writeFile(
      presetFile(params.projectId, params.workflowKey, id),
      `${JSON.stringify(preset, null, 2)}\n`,
    );
    return { preset, created };
  }

  async function deleteOne(params: PresetsDeleteParams): Promise<PresetsDeleteResult> {
    const file = presetFile(params.projectId, params.workflowKey, params.presetId);
    if (!(await fs.exists(file))) return { deleted: false };
    await fs.deleteFile(file);
    return { deleted: true };
  }

  return {
    list,
    get,
    save,
    delete: deleteOne,
  };
}
