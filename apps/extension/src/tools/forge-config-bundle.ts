import { parseWorkflowBucketConfig, type WorkflowBucketConfig } from './data-bucket.service.js';
// Imported from the schema module, not from `forge-tools-settings.js`, which
// re-exports the same symbols but pulls in `vscode` with them — this module is
// covered by unit tests and must stay loadable outside the extension host.
import {
  parseEnvironments,
  parsePseudoUiTenantStyle,
  parseQuickRunSettings,
  sanitizeEnvironmentsForSharing,
  type EnvironmentsConfig,
  type PseudoUiTenantStyleSettings,
  type QuickRunHeader,
  type QuickRunSettings,
} from './forge-settings-schema.js';

/**
 * Bump only on a breaking change to the shape below. An unknown *higher*
 * version is refused rather than best-effort parsed: a bundle written by a
 * newer Forge may carry a bucket this build would silently drop, and a partial
 * import is worse than a stated refusal.
 */
export const BUNDLE_VERSION = 1;

export interface DataBucketEntry {
  domain: string;
  workflowKey: string;
  config: WorkflowBucketConfig;
}

export interface ForgeConfigBundle {
  version: number;
  exportedAt: string;
  quickRun?: QuickRunSettings;
  environments?: EnvironmentsConfig;
  tenantStyle?: PseudoUiTenantStyleSettings;
  dataBuckets?: DataBucketEntry[];
}

/** Buckets a user can pick from when exporting or importing. */
export const BUNDLE_BUCKETS = ['quickRun', 'environments', 'tenantStyle', 'dataBuckets'] as const;
export type BundleBucket = (typeof BUNDLE_BUCKETS)[number];

export const BUNDLE_BUCKET_LABELS: Record<BundleBucket, string> = {
  quickRun: 'Global headers & polling',
  environments: 'Environments',
  tenantStyle: 'Tenant stylesheet',
  dataBuckets: 'Workflow test data',
};

export interface BundleSources {
  quickRun: QuickRunSettings;
  environments: EnvironmentsConfig;
  tenantStyle: PseudoUiTenantStyleSettings;
  dataBuckets: DataBucketEntry[];
}

export interface BuildBundleOptions {
  /** When false, header names are kept but values are blanked. */
  includeSecretValues: boolean;
  /** `exportedAt` — injected so this stays a pure function. */
  now: string;
}

/**
 * Assembles the selected buckets into one distributable file.
 *
 * Environments go through `sanitizeEnvironmentsForSharing`, so a bundle never
 * carries this machine's absolute container paths or its personal
 * active-environment pointer.
 */
export function buildBundle(
  selection: readonly BundleBucket[],
  sources: BundleSources,
  options: BuildBundleOptions,
): ForgeConfigBundle {
  const bundle: ForgeConfigBundle = { version: BUNDLE_VERSION, exportedAt: options.now };

  if (selection.includes('quickRun')) {
    bundle.quickRun = options.includeSecretValues
      ? sources.quickRun
      : { ...sources.quickRun, globalHeaders: stripHeaderValues(sources.quickRun.globalHeaders) };
  }
  if (selection.includes('environments')) {
    bundle.environments = sanitizeEnvironmentsForSharing(sources.environments);
  }
  if (selection.includes('tenantStyle')) {
    bundle.tenantStyle = sources.tenantStyle;
  }
  if (selection.includes('dataBuckets')) {
    bundle.dataBuckets = sources.dataBuckets;
  }
  return bundle;
}

/**
 * Keeps the shape, drops the values — the right default for handing a config
 * template to a teammate who will supply their own token.
 */
export function stripHeaderValues(headers: readonly QuickRunHeader[]): QuickRunHeader[] {
  return headers.map((h) => ({ ...h, value: '' }));
}

export interface ParsedBundle {
  bundle: ForgeConfigBundle | null;
  /** Non-fatal notes: a bucket that was present but unusable, and was dropped. */
  warnings: string[];
  /** Set when nothing could be imported at all. */
  error: string | null;
}

/**
 * Validates an arbitrary parsed-JSON value into a bundle.
 *
 * Reuses the same coercing validators the settings service applies to files on
 * disk (`parseQuickRunSettings` and friends) rather than inventing a second
 * notion of "valid" — they drop bad entries and fill defaults instead of
 * throwing, which is exactly the behaviour a hand-edited bundle wants. A bucket
 * that is present but unusable is reported as a warning and skipped; the rest
 * still import.
 */
export function parseBundle(raw: unknown): ParsedBundle {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { bundle: null, warnings: [], error: 'This file is not a Forge Tools config bundle.' };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    return { bundle: null, warnings: [], error: 'This file is missing a bundle version.' };
  }
  if (obj.version > BUNDLE_VERSION) {
    return {
      bundle: null,
      warnings: [],
      error: `This bundle was written by a newer version of Forge (bundle version ${obj.version}). Update the extension to import it.`,
    };
  }

  const warnings: string[] = [];
  const bundle: ForgeConfigBundle = {
    version: obj.version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
  };

  if (obj.quickRun != null) bundle.quickRun = parseQuickRunSettings(obj.quickRun);
  if (obj.environments != null) bundle.environments = parseEnvironments(obj.environments);
  if (obj.tenantStyle != null) bundle.tenantStyle = parsePseudoUiTenantStyle(obj.tenantStyle);

  if (obj.dataBuckets != null) {
    if (!Array.isArray(obj.dataBuckets)) {
      warnings.push('Workflow test data was not a list and has been skipped.');
    } else {
      const entries: DataBucketEntry[] = [];
      for (const item of obj.dataBuckets) {
        if (item == null || typeof item !== 'object') continue;
        const entry = item as Record<string, unknown>;
        const config = parseWorkflowBucketConfig(entry.config);
        if (typeof entry.domain !== 'string' || typeof entry.workflowKey !== 'string' || !config) {
          warnings.push('A workflow test data entry was unreadable and has been skipped.');
          continue;
        }
        entries.push({ domain: entry.domain, workflowKey: entry.workflowKey, config });
      }
      bundle.dataBuckets = entries;
    }
  }

  if (bucketsIn(bundle).length === 0) {
    return { bundle: null, warnings, error: 'This bundle contains no importable settings.' };
  }
  return { bundle, warnings, error: null };
}

/** Which buckets a bundle actually carries — drives both the preview and the apply loop. */
export function bucketsIn(bundle: ForgeConfigBundle): BundleBucket[] {
  return BUNDLE_BUCKETS.filter((bucket) => bundle[bucket] != null);
}

export interface ImportChange {
  bucket: BundleBucket;
  /** One line for the confirmation, e.g. `Environments — 3 (replaces 1)`. */
  summary: string;
}

/**
 * What applying this bundle would change, for the confirmation prompt.
 *
 * Import replaces per bucket, so the counts are "incoming (replaces current)"
 * rather than a diff — matching what actually happens avoids implying a merge
 * that does not occur.
 */
export function summarizeImport(bundle: ForgeConfigBundle, current: BundleSources): ImportChange[] {
  const changes: ImportChange[] = [];
  if (bundle.quickRun) {
    changes.push({
      bucket: 'quickRun',
      summary: `${BUNDLE_BUCKET_LABELS.quickRun} — ${bundle.quickRun.globalHeaders.length} header(s), replacing ${current.quickRun.globalHeaders.length}`,
    });
  }
  if (bundle.environments) {
    changes.push({
      bucket: 'environments',
      summary: `${BUNDLE_BUCKET_LABELS.environments} — ${bundle.environments.environments.length}, replacing ${current.environments.environments.length}`,
    });
  }
  if (bundle.tenantStyle) {
    changes.push({
      bucket: 'tenantStyle',
      summary: `${BUNDLE_BUCKET_LABELS.tenantStyle} — ${bundle.tenantStyle.enabled ? bundle.tenantStyle.value || 'enabled' : 'disabled'}`,
    });
  }
  if (bundle.dataBuckets) {
    changes.push({
      bucket: 'dataBuckets',
      summary: `${BUNDLE_BUCKET_LABELS.dataBuckets} — ${bundle.dataBuckets.length} workflow(s)`,
    });
  }
  return changes;
}

/**
 * Header names whose value should not leave this machine without the user
 * saying so.
 *
 * Both signals count: the explicit `isSecret` flag, and a name that reads like
 * a credential. The name check exists because `isSecret` is opt-in and nothing
 * has ever prompted anyone to set it — most existing configs will have an
 * `Authorization` header with the flag unset.
 */
const SECRET_NAME_PATTERN = /authorization|token|secret|api[-_ ]?key|password|cookie|credential/i;

export function looksSecret(headerName: string): boolean {
  return SECRET_NAME_PATTERN.test(headerName);
}

/** Names of headers that carry a non-empty value and look sensitive. */
export function collectSecretHeaderNames(
  headers: readonly QuickRunHeader[] | undefined,
): string[] {
  if (!headers) return [];
  return headers
    .filter((h) => h.value !== '' && (h.isSecret === true || looksSecret(h.name)))
    .map((h) => h.name);
}
