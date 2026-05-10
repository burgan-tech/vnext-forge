import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import * as tar from 'tar';

import type { LoggerAdapter } from '../../adapters/logger.js';
import type { FileSystemAdapter } from '../../adapters/file-system.js';

/**
 * Per-version schema cache for `@burgan-tech/vnext-schema`.
 *
 * Why we need this: every project's `vnext.config.json` carries a
 * `schemaVersion` (e.g. `"0.0.33"`). The bundled `vnext-schema` shipped
 * inside the desktop app is a single, fixed version (whatever
 * `services-core/package.json` resolved at build time). If the user's
 * project targets a different version, validating with the bundled one
 * gives false positives/negatives — fields that were valid in 0.0.33 may
 * have been deprecated by 0.0.49, and vice versa.
 *
 * This service:
 *  1. Resolves a version → on-disk cache path under `<userData>/schema-cache/<version>/`
 *  2. Downloads the npm tarball on first use (`registry.npmjs.org/<pkg>/-/<v>.tgz`)
 *  3. Extracts it to the cache (the npm tarball lays out a `package/` subdir)
 *  4. `require()`s the extracted package and memoizes the loaded module
 *
 * Concurrent calls for the same version are deduped via a promise map so
 * we don't fire two downloads for the same target.
 */

export interface VnextSchemaModule {
  getSchema(type: string): Record<string, unknown> | null;
  getAvailableTypes(): string[];
  schemas: Record<string, Record<string, unknown>>;
}

export interface SchemaCacheServiceDeps {
  fs: FileSystemAdapter;
  logger: LoggerAdapter;
  /** Absolute root for cached versions (no trailing slash). */
  cacheRoot: string;
  /**
   * Bundled module for the fallback path. When the user's machine is
   * offline and they ask for a version we don't have cached, we surface
   * a clear error rather than silently using the wrong version.
   * `bundledVersion` is reported to the caller so the UI can warn about
   * mismatch.
   */
  bundledModule: VnextSchemaModule;
  bundledVersion: string;
  /** npm registry base URL — overridable for tests / corporate proxies. */
  registryBase?: string;
  /** Package name on npm. */
  packageName?: string;
}

export interface ResolvedSchema {
  module: VnextSchemaModule;
  /** The version actually loaded (may be the requested version OR the bundled fallback). */
  version: string;
  /** True when this came from the bundled module, not a downloaded cache entry. */
  fromBundle: boolean;
  /** Where the cache lives on disk; absent for bundled module. */
  cachePath?: string;
}

export interface SchemaCacheService {
  /**
   * Get the schema module for `version`. If `version` matches the
   * bundled one, returns the bundled module immediately. Otherwise
   * resolves from cache; if the cache is empty, downloads + extracts
   * from npm. Returns `{ fromBundle: true }` when network is unreachable
   * AND no cache entry exists, so the caller can warn.
   */
  resolve(version: string): Promise<ResolvedSchema>;
  /** True when the cache has the version on disk (no network needed). */
  has(version: string): Promise<boolean>;
  /** Force a re-download for the version (clears cache, refetches). */
  refresh(version: string): Promise<ResolvedSchema>;
  /** List currently-cached versions (for UI inspector). */
  listCachedVersions(): Promise<string[]>;
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_PACKAGE = '@burgan-tech/vnext-schema';

export function createSchemaCacheService(
  deps: SchemaCacheServiceDeps,
): SchemaCacheService {
  const { fs, logger, cacheRoot, bundledModule, bundledVersion } = deps;
  const registry = deps.registryBase ?? DEFAULT_REGISTRY;
  const pkg = deps.packageName ?? DEFAULT_PACKAGE;

  // In-memory dedup so two concurrent validators asking for the same
  // version don't kick off two parallel downloads.
  const inflight = new Map<string, Promise<ResolvedSchema>>();
  // Per-version cached require result.
  const loaded = new Map<string, VnextSchemaModule>();

  function versionDir(version: string): string {
    return path.join(cacheRoot, version);
  }

  /** The npm tarball lays itself out under `package/` inside the cache dir. */
  function extractedPackageDir(version: string): string {
    return path.join(versionDir(version), 'package');
  }

  async function has(version: string): Promise<boolean> {
    if (version === bundledVersion) return true;
    return fs.exists(extractedPackageDir(version));
  }

  async function listCachedVersions(): Promise<string[]> {
    if (!(await fs.exists(cacheRoot))) return [];
    const entries = await fs.readDir(cacheRoot);
    return entries.filter((e) => e.isDirectory).map((e) => e.name);
  }

  /**
   * The npm registry exposes tarballs at predictable URLs:
   *
   *   https://registry.npmjs.org/@burgan-tech/vnext-schema/-/vnext-schema-0.0.33.tgz
   *
   * For scoped packages the tarball name strips the scope. Build the URL
   * directly so we don't pay the cost of fetching the manifest first.
   */
  function tarballUrl(version: string): string {
    const tarballName = pkg.startsWith('@')
      ? pkg.split('/')[1] // "@burgan-tech/vnext-schema" → "vnext-schema"
      : pkg;
    return `${registry}/${pkg}/-/${tarballName}-${version}.tgz`;
  }

  async function downloadAndExtract(version: string): Promise<string> {
    const url = tarballUrl(version);
    logger.info?.(
      { source: 'SchemaCacheService.download', version, url, code: 'SCHEMA_CACHE_FETCH' },
      'Downloading vnext-schema tarball',
    );

    const target = versionDir(version);
    await fs.mkdir(target, { recursive: true });

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/octet-stream',
          'user-agent': 'vnext-forge-studio/schema-cache',
        },
      });
    } catch (err) {
      throw new Error(
        `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `npm registry returned HTTP ${response.status} for ${url}. Verify the version exists in vnext.config.json.`,
      );
    }
    if (!response.body) {
      throw new Error(`npm registry response had no body for ${url}.`);
    }

    // Stream the gzipped tarball straight into `tar.x` — it handles gunzip
    // internally. `pipeline` makes sure errors propagate and the stream is
    // closed cleanly.
    const nodeStream = Readable.fromWeb(response.body as never);
    await pipeline(
      nodeStream,
      tar.x({
        cwd: target,
        // Strip the leading `package/` so we get a clean directory; but
        // we WANT `package/` in our case because nodeRequire resolves a
        // package via its package.json which lives there. Skip strip.
      }),
    );
    return extractedPackageDir(version);
  }

  function loadFromDisk(version: string): VnextSchemaModule {
    if (loaded.has(version)) return loaded.get(version)!;
    const dir = extractedPackageDir(version);
    // `createRequire(import.meta.url)` doesn't help for absolute paths;
    // we need a require rooted at the extracted package dir's parent.
    // Trick: createRequire from a fake file inside the cache dir.
    const fakeRequirer = path.join(dir, '__vnext_forge_loader.cjs');
    const requireFromCache = createRequire(fakeRequirer);
    const mod = requireFromCache(dir) as VnextSchemaModule;
    loaded.set(version, mod);
    return mod;
  }

  async function resolveOnce(version: string): Promise<ResolvedSchema> {
    // Fast path: bundled version request — no IO at all.
    if (version === bundledVersion) {
      return { module: bundledModule, version, fromBundle: true };
    }

    // Already extracted on disk?
    if (await fs.exists(extractedPackageDir(version))) {
      return {
        module: loadFromDisk(version),
        version,
        fromBundle: false,
        cachePath: extractedPackageDir(version),
      };
    }

    // Download path.
    try {
      const dir = await downloadAndExtract(version);
      logger.info?.(
        { source: 'SchemaCacheService.resolve', version, dir, code: 'SCHEMA_CACHE_HIT_FRESH' },
        'vnext-schema cached + loaded',
      );
      return {
        module: loadFromDisk(version),
        version,
        fromBundle: false,
        cachePath: dir,
      };
    } catch (err) {
      logger.warn?.(
        {
          source: 'SchemaCacheService.resolve',
          version,
          bundledVersion,
          error: err instanceof Error ? err.message : String(err),
          code: 'SCHEMA_CACHE_FALLBACK_BUNDLED',
        },
        'vnext-schema download failed; falling back to bundled module (validation may report wrong errors)',
      );
      return {
        module: bundledModule,
        version: bundledVersion,
        fromBundle: true,
      };
    }
  }

  async function resolve(version: string): Promise<ResolvedSchema> {
    if (inflight.has(version)) return inflight.get(version)!;
    const promise = resolveOnce(version).finally(() => {
      inflight.delete(version);
    });
    inflight.set(version, promise);
    return promise;
  }

  async function refresh(version: string): Promise<ResolvedSchema> {
    if (version !== bundledVersion) {
      const target = versionDir(version);
      if (await fs.exists(target)) {
        await fs.rmrf(target);
      }
      loaded.delete(version);
    }
    return resolve(version);
  }

  return {
    resolve,
    has,
    refresh,
    listCachedVersions,
  };
}
