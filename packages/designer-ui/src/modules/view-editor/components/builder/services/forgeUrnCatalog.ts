/**
 * Forge URN action catalog — surfaces workflow transitions and BFF
 * function URNs from the active vnext workspace so the Builder's
 * ActionEditor can offer real, in-project options instead of forcing
 * the author to type URNs by hand.
 *
 * Reference: `forgeactionmodelintegration.md §3.5` (DomainActionCatalog
 * interface). Navigation and tenant catalogs are intentionally left
 * empty in v0 — Forge Quick Runner has no router and tenant config
 * is out of scope (R31 placeholder).
 *
 * The catalog is keyed by project id and lazily built; consumers
 * should invalidate it on workspace fs-change events (the wrapper
 * hook handles that).
 */

import { discoverVnextComponentsByCategory } from '../../../../vnext-workspace/vnextComponentDiscovery';
import * as WorkspaceApi from '../../../../project-workspace/WorkspaceApi';

export type DomainActionGroup = 'workflow' | 'function' | 'navigation' | 'custom';

export interface DomainActionEntry {
  /** URN passed to delegate.onAction as `command`. */
  urn: string;
  /** Short label shown in the picker. */
  label: string;
  /** Optional secondary line (e.g. domain qualifier). */
  description?: string;
  /** Picker default for `ActionDescriptor.validate` when this entry is chosen. */
  defaultValidate?: boolean;
  group: DomainActionGroup;
}

export interface ForgeUrnCatalog {
  workflows: DomainActionEntry[];
  functions: DomainActionEntry[];
  /** Reserved for R29+ (navigation has no Quick Runner runtime today). */
  navigation: DomainActionEntry[];
  /** Reserved for R31 (tenant custom action catalog). */
  custom: DomainActionEntry[];
}

export const EMPTY_URN_CATALOG: ForgeUrnCatalog = {
  workflows: [],
  functions: [],
  navigation: [],
  custom: [],
};

// ── Internal shapes for parsing workflow attributes — keep minimal so
// the catalog isn't coupled to the full workflow vocabulary. We only
// read the transition coordinates we need.

interface WorkflowAttributes {
  startTransition?: { key?: string; target?: string; labels?: Array<{ label?: string }> };
  states?: Array<{
    key?: string;
    transitions?: Array<{ key?: string; target?: string; labels?: Array<{ label?: string }> }>;
  }>;
}

interface WorkflowFile {
  key?: string;
  domain?: string;
  attributes?: WorkflowAttributes;
}

interface FunctionFile {
  key?: string;
  domain?: string;
}

/**
 * Build the catalog for a project by enumerating its workflow and
 * function components. Errors per-component are tolerated: a single
 * malformed file shouldn't kill the whole picker.
 */
export async function buildForgeUrnCatalog(projectId: string): Promise<ForgeUrnCatalog> {
  const [workflows, functions] = await Promise.all([
    collectWorkflowTransitions(projectId).catch((err) => {
      // eslint-disable-next-line no-console -- catalog construction is non-fatal
      console.warn('[forgeUrnCatalog] workflow discovery failed', err);
      return [];
    }),
    collectFunctionEntries(projectId).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[forgeUrnCatalog] function discovery failed', err);
      return [];
    }),
  ]);

  return {
    workflows,
    functions,
    navigation: [],
    custom: [],
  };
}

async function collectWorkflowTransitions(projectId: string): Promise<DomainActionEntry[]> {
  const components = await discoverVnextComponentsByCategory(projectId, 'workflows');
  const entries: DomainActionEntry[] = [];

  // Read in parallel for responsiveness on larger projects.
  const files = await Promise.all(
    components.map(async (c) => {
      try {
        const result = await WorkspaceApi.readFile(c.path);
        const parsed = JSON.parse(result.content) as WorkflowFile;
        return { discovered: c, parsed };
      } catch {
        return null;
      }
    }),
  );

  for (const file of files) {
    if (!file) continue;
    const { discovered, parsed } = file;
    const flow = parsed.key ?? discovered.key;
    if (!flow) continue;

    const transitionKeys = collectTransitionKeys(parsed.attributes);
    for (const tx of transitionKeys) {
      const urn = `urn:amorphie:wf:${flow}:transition:${tx.key}`;
      entries.push({
        urn,
        label: `${flow} → ${tx.key}`,
        description: tx.label && tx.label !== tx.key ? tx.label : undefined,
        // Continue / approve / save-like transitions usually want
        // form validation; the picker can flip per-action anyway.
        defaultValidate: !isLikelyBackOrCancel(tx.key),
        group: 'workflow',
      });
    }
  }

  return entries;
}

function collectTransitionKeys(
  attrs: WorkflowAttributes | undefined,
): Array<{ key: string; label?: string }> {
  if (!attrs) return [];
  const out: Array<{ key: string; label?: string }> = [];
  const seen = new Set<string>();

  // `startTransition` is a single transition off the workflow entry.
  if (attrs.startTransition?.key) {
    const k = attrs.startTransition.key;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ key: k, label: pickEnLabel(attrs.startTransition.labels) });
    }
  }

  for (const state of attrs.states ?? []) {
    for (const tx of state.transitions ?? []) {
      if (!tx.key || seen.has(tx.key)) continue;
      seen.add(tx.key);
      out.push({ key: tx.key, label: pickEnLabel(tx.labels) });
    }
  }
  return out;
}

function pickEnLabel(
  labels: Array<{ label?: string; language?: string }> | undefined,
): string | undefined {
  if (!labels) return undefined;
  const en = labels.find((l) => (l as { language?: string }).language === 'en');
  return en?.label ?? labels[0]?.label;
}

function isLikelyBackOrCancel(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'back' || k === 'cancel' || k === 'previous' || k === 'abort';
}

async function collectFunctionEntries(projectId: string): Promise<DomainActionEntry[]> {
  const components = await discoverVnextComponentsByCategory(projectId, 'functions');
  const entries: DomainActionEntry[] = [];

  const files = await Promise.all(
    components.map(async (c) => {
      try {
        const result = await WorkspaceApi.readFile(c.path);
        const parsed = JSON.parse(result.content) as FunctionFile;
        return { discovered: c, parsed };
      } catch {
        return null;
      }
    }),
  );

  for (const file of files) {
    if (!file) continue;
    const { discovered, parsed } = file;
    const domain = parsed.domain ?? '';
    const key = parsed.key ?? discovered.key;
    if (!domain || !key) continue;

    const urn = `urn:amorphie:func:${domain}:${key}`;
    entries.push({
      urn,
      label: key,
      description: `domain: ${domain}`,
      defaultValidate: false,
      group: 'function',
    });
  }
  return entries;
}
