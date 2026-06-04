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

export type DomainActionGroup =
  | 'workflow'
  | 'workflow-start'
  | 'function'
  | 'navigation'
  | 'custom';

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
  /** Transition URNs in current-instance form
   *  (`urn:vnext:flow:transition:<domain>:<flow>:<state>`). */
  workflows: DomainActionEntry[];
  /** Flow-start URNs (`urn:vnext:flow:start:<domain>:<flow>`). One
   *  entry per workflow discovered in the project. */
  workflowStarts: DomainActionEntry[];
  functions: DomainActionEntry[];
  /** Reserved for R29+ (navigation has no Quick Runner runtime today). */
  navigation: DomainActionEntry[];
  /** Reserved for R31 (tenant custom action catalog). */
  custom: DomainActionEntry[];
}

export const EMPTY_URN_CATALOG: ForgeUrnCatalog = {
  workflows: [],
  workflowStarts: [],
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
  const [workflowEntries, functions] = await Promise.all([
    collectWorkflowEntries(projectId).catch((err) => {
      // eslint-disable-next-line no-console -- catalog construction is non-fatal
      console.warn('[forgeUrnCatalog] workflow discovery failed', err);
      return { transitions: [], starts: [] };
    }),
    collectFunctionEntries(projectId).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[forgeUrnCatalog] function discovery failed', err);
      return [];
    }),
  ]);

  return {
    workflows: workflowEntries.transitions,
    workflowStarts: workflowEntries.starts,
    functions,
    navigation: [],
    custom: [],
  };
}

async function collectWorkflowEntries(
  projectId: string,
): Promise<{ transitions: DomainActionEntry[]; starts: DomainActionEntry[] }> {
  const components = await discoverVnextComponentsByCategory(projectId, 'workflows');
  const transitions: DomainActionEntry[] = [];
  const starts: DomainActionEntry[] = [];

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
    const domain = parsed.domain;
    if (!flow || !domain) continue;

    // Flow start — one entry per workflow.
    starts.push({
      urn: `urn:vnext:flow:start:${domain}:${flow}`,
      label: `start: ${flow}`,
      description: `domain: ${domain}`,
      // Start usually wants the form payload validated before firing.
      defaultValidate: true,
      group: 'workflow-start',
    });

    // Transitions — current-instance form (no instance segment).
    const transitionKeys = collectTransitionKeys(parsed.attributes);
    for (const tx of transitionKeys) {
      const urn = `urn:vnext:flow:transition:${domain}:${flow}:${tx.key}`;
      transitions.push({
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

  return { transitions, starts };
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

    // Default-verb domain-scoped form. Picker UI offers a verb
    // override (GET/POST/PATCH/DELETE); selection mutates the
    // emitted URN to `urn:vnext:fn:<verb>:<domain>:<key>`.
    const urn = `urn:vnext:fn:${domain}:${key}`;
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
