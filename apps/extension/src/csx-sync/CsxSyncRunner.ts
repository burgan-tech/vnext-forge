import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { VnextWorkspaceConfig } from '@vnext-forge-studio/services-core';

import { walkMappingTriples, type MappingTripleHit } from './jsonMappingWalker.js';

export type CsxSyncEncoding = 'B64' | 'NAT' | 'REF';

export interface CsxSyncRunResult {
  /** Absolute path of the source `.csx` file. */
  csxFile: string;
  /** Total component JSONs scanned during the run. */
  scanned: number;
  /** Component JSONs that had at least one matching mapping. */
  matched: number;
  /** Component JSONs we actually wrote back to disk. */
  updated: number;
  /** Per-file update summary, useful for the "Sync now" notification. */
  files: Array<{ path: string; updates: number; encodings: CsxSyncEncoding[] }>;
  /** Component paths that failed to parse or update; surface but don't abort the run. */
  errors: Array<{ path: string; message: string }>;
}

/** Compose the encoded `code` value for a given encoding. Returns `null` for `REF` (caller skips). */
export function encodeCsxForJson(content: string, encoding: CsxSyncEncoding): string | null {
  if (encoding === 'REF') return null;
  if (encoding === 'NAT') return content;
  // Default + 'B64': base64-encode the raw UTF-8 bytes. Matches the
  // original `csx-json-sync` extension and `vnext-types/csx-codec`.
  return Buffer.from(content, 'utf8').toString('base64');
}

/** Pick the right encoding for a hit, applying the workspace default when the field is missing. */
function resolveEncoding(
  hitEncoding: string | undefined,
  defaultEncoding: 'B64' | 'NAT',
): CsxSyncEncoding {
  if (hitEncoding === 'B64' || hitEncoding === 'NAT' || hitEncoding === 'REF') {
    return hitEncoding;
  }
  return defaultEncoding;
}

function normalizePosix(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

/**
 * Resolve a mapping's `location` (e.g. `./onEntry.csx`) against the
 * component JSON's directory to an absolute POSIX-normalised path.
 * Reverse direction of `resolveWorkflowScriptAbsolutePath`.
 */
function resolveMappingLocation(jsonFilePath: string, location: string): string {
  const trimmed = location.trim();
  const relative = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  const baseDir = normalizePosix(path.dirname(jsonFilePath));
  return normalizePosix(`${baseDir}/${relative}`);
}

/** OS-aware path equality. Windows volumes are case-insensitive; POSIX file systems treat case strictly. */
function pathsEqual(a: string, b: string): boolean {
  const na = normalizePosix(a);
  const nb = normalizePosix(b);
  if (process.platform === 'win32') {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}

export interface CsxSyncRunnerDeps {
  /**
   * Lists every component JSON inside the workspace. We delegate
   * discovery to the caller so the runner stays purely Node-shaped —
   * the extension host wires this up via the projectService scanner.
   */
  listComponentJsonPaths(workspaceRoot: string, config: VnextWorkspaceConfig): Promise<string[]>;
  /** Default encoding when the mapping object omits the field. */
  defaultEncoding: 'B64' | 'NAT';
  /** Optional structured logger; falls back to `console` no-ops when absent. */
  log?: {
    info?: (msg: string, meta?: Record<string, unknown>) => void;
    warn?: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Pure logic: given a saved `.csx` path, scan every component JSON
 * in the owning workspace, find every mapping that references it,
 * encode the CSX body per each mapping's `encoding`, and rewrite the
 * JSON(s) back to disk. Does NOT touch `REF` entries.
 *
 * Caller-owned concerns (left out of this module):
 *   - filtering saves to vNext workspace roots
 *   - debouncing rapid saves
 *   - surfacing notifications / opening output channels
 *
 * Returns a summary the caller can log or display.
 */
export async function runCsxSync(
  csxFile: string,
  workspaceRoot: string,
  config: VnextWorkspaceConfig,
  deps: CsxSyncRunnerDeps,
): Promise<CsxSyncRunResult> {
  const log = deps.log ?? {};
  const result: CsxSyncRunResult = {
    csxFile,
    scanned: 0,
    matched: 0,
    updated: 0,
    files: [],
    errors: [],
  };

  let csxContent: string;
  try {
    csxContent = await fs.readFile(csxFile, 'utf8');
  } catch (err) {
    result.errors.push({
      path: csxFile,
      message: `Failed to read CSX file: ${err instanceof Error ? err.message : String(err)}`,
    });
    return result;
  }

  let componentPaths: string[] = [];
  try {
    componentPaths = await deps.listComponentJsonPaths(workspaceRoot, config);
  } catch (err) {
    result.errors.push({
      path: workspaceRoot,
      message: `Failed to enumerate component JSON files: ${err instanceof Error ? err.message : String(err)}`,
    });
    return result;
  }
  result.scanned = componentPaths.length;

  for (const jsonPath of componentPaths) {
    let raw: string;
    try {
      raw = await fs.readFile(jsonPath, 'utf8');
    } catch (err) {
      result.errors.push({
        path: jsonPath,
        message: `read failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // Non-fatal: skip malformed JSON. The author will see it in
      // VS Code's Problems panel via the JSON language server.
      result.errors.push({
        path: jsonPath,
        message: `parse failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const hits = walkMappingTriples(parsed);
    if (hits.length === 0) continue;

    const matchingHits: MappingTripleHit[] = hits.filter((hit) =>
      pathsEqual(resolveMappingLocation(jsonPath, hit.location), csxFile),
    );
    if (matchingHits.length === 0) continue;

    result.matched += 1;

    let mutated = false;
    const encodingsApplied: CsxSyncEncoding[] = [];

    for (const hit of matchingHits) {
      const encoding = resolveEncoding(hit.encoding, deps.defaultEncoding);
      if (encoding === 'REF') {
        // sys-mappings reference: nothing to mirror back from a CSX
        // file. Leave the existing structured `code` object intact.
        continue;
      }
      const nextCode = encodeCsxForJson(csxContent, encoding);
      if (nextCode === null) continue;

      const sameCode = hit.code === nextCode;
      const sameEncoding = hit.encoding === encoding;
      if (sameCode && sameEncoding) continue;

      hit.node.code = nextCode;
      hit.node.encoding = encoding;
      mutated = true;
      encodingsApplied.push(encoding);
    }

    if (!mutated) continue;

    const serialised = `${JSON.stringify(parsed, null, 2)}\n`;
    try {
      await fs.writeFile(jsonPath, serialised, 'utf8');
      result.updated += 1;
      result.files.push({
        path: jsonPath,
        updates: encodingsApplied.length,
        encodings: encodingsApplied,
      });
      log.info?.('csx-sync wrote component JSON', {
        csxFile,
        jsonPath,
        updates: encodingsApplied.length,
        encodings: encodingsApplied,
      });
    } catch (err) {
      result.errors.push({
        path: jsonPath,
        message: `write failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return result;
}
