/**
 * Utilities for collecting audience metadata (roles, languages) from a
 * workflow JSON document.  These are used to populate UI pickers such as
 * the AudienceRolePickerDialog.
 *
 * All functions accept `unknown` input and apply defensive type assertions —
 * the caller is not required to pre-validate the shape.
 *
 * When a `ComponentResolver` is provided, both `collectWorkflowRoles` and
 * `collectWorkflowLanguages` follow same-domain subflow references
 * recursively (cross-domain subflows are skipped). The full subflow chain is
 * traced with cycle detection so circular references never cause infinite
 * loops.
 */

import type { ComponentResolver } from './openapi-doc';

// ---------------------------------------------------------------------------
// Internal type helpers (not exported)
// ---------------------------------------------------------------------------

interface RoleGrant {
  role?: unknown;
  grant?: unknown;
}

interface LabelEntry {
  language?: unknown;
}

interface TransitionLike {
  roles?: unknown;
  labels?: unknown;
}

interface StateLike {
  transitions?: unknown;
  labels?: unknown;
  queryRoles?: unknown;
  subFlow?: unknown;
}

interface AttributesLike {
  labels?: unknown;
  startTransition?: unknown;
  states?: unknown;
  sharedTransitions?: unknown;
  cancel?: unknown;
  exit?: unknown;
  updateData?: unknown;
  queryRoles?: unknown;
}

interface WorkflowLike {
  attributes?: unknown;
  /** Top-level domain — used to skip cross-domain subflows. */
  domain?: unknown;
  /** Workflow key — used for cycle detection. */
  key?: unknown;
}

interface SubFlowProcess {
  key?: unknown;
  domain?: unknown;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// ---------------------------------------------------------------------------
// Low-level collectors
// ---------------------------------------------------------------------------

// Only the `role` name is collected; `grant` (allow/deny) is intentionally
// ignored here — callers receive the full set of role identifiers and decide
// how to interpret grants themselves.
function collectRolesFromArray(roles: unknown, out: Set<string>): void {
  for (const entry of asArray(roles)) {
    if (isObject(entry)) {
      const grant = entry as RoleGrant;
      const role = asString(grant.role);
      if (role) out.add(role);
    }
  }
}

function collectRolesFromTransition(transition: unknown, out: Set<string>): void {
  if (!isObject(transition)) return;
  collectRolesFromArray((transition as TransitionLike).roles, out);
}

function collectLanguagesFromArray(labels: unknown, out: Set<string>): void {
  for (const entry of asArray(labels)) {
    if (isObject(entry)) {
      const labelEntry = entry as LabelEntry;
      const lang = asString(labelEntry.language);
      if (lang) out.add(lang);
    }
  }
}

function collectLanguagesFromTransition(transition: unknown, out: Set<string>): void {
  if (!isObject(transition)) return;
  collectLanguagesFromArray((transition as TransitionLike).labels, out);
}

// ---------------------------------------------------------------------------
// Subflow traversal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a stable visit key for cycle detection.
 * Uses `domain:key` when both are present, otherwise just `key`.
 */
function visitKey(domain: string | undefined, key: string | undefined): string | undefined {
  if (!key) return undefined;
  return domain ? `${domain}:${key}` : key;
}

/**
 * Resolves a same-domain subflow reference and returns its parsed JSON, or
 * `undefined` when the reference is cross-domain, unresolvable, or already
 * visited. Mutates `visited` when a new subflow is entered.
 */
function resolveSubflow(
  proc: SubFlowProcess,
  parentDomain: string | undefined,
  resolveComponent: ComponentResolver,
  visited: Set<string>,
): Record<string, unknown> | undefined {
  const procDomain = asString(proc.domain);
  // Skip cross-domain subflows — same logic as openapi-doc.ts §428-429.
  if (procDomain && parentDomain && parentDomain !== '{domain}' && procDomain !== parentDomain) {
    return undefined;
  }
  const resolved = resolveComponent(proc as Parameters<ComponentResolver>[0]);
  if (!resolved) return undefined;
  const resolvedKey = asString(resolved.key);
  const resolvedDomain = asString(resolved.domain);
  const vk = visitKey(resolvedDomain ?? procDomain, resolvedKey ?? asString(proc.key));
  // Only check here — the recursive collectRoles/Languages call will add the key,
  // making subsequent resolveSubflow calls for the same target a no-op.
  if (!vk || visited.has(vk)) return undefined;
  return resolved;
}

// ---------------------------------------------------------------------------
// Core recursive scanners
// ---------------------------------------------------------------------------

function collectRolesFromWorkflow(
  workflowJson: unknown,
  resolveComponent: ComponentResolver | undefined,
  visited: Set<string>,
  out: Set<string>,
): void {
  if (!isObject(workflowJson)) return;
  const wf = workflowJson as WorkflowLike;
  const wfKey = asString(wf.key);
  const wfDomain = asString(wf.domain);

  // Guard: mark this workflow visited before scanning to prevent cycles.
  const vk = visitKey(wfDomain, wfKey);
  if (vk) {
    if (visited.has(vk)) return;
    visited.add(vk);
  }

  if (!isObject(wf.attributes)) return;
  const attrs = wf.attributes as AttributesLike;

  // startTransition roles
  collectRolesFromTransition(attrs.startTransition, out);

  // states[].transitions[].roles and states[].queryRoles; recurse into subflows
  for (const state of asArray(attrs.states)) {
    if (!isObject(state)) continue;
    const s = state as StateLike;
    for (const transition of asArray(s.transitions)) {
      collectRolesFromTransition(transition, out);
    }
    collectRolesFromArray(s.queryRoles, out);

    if (resolveComponent && isObject(s.subFlow)) {
      const sf = s.subFlow as { process?: unknown };
      if (isObject(sf.process)) {
        const subWf = resolveSubflow(sf.process as SubFlowProcess, wfDomain, resolveComponent, visited);
        if (subWf) collectRolesFromWorkflow(subWf, resolveComponent, visited, out);
      }
    }
  }

  // sharedTransitions[].roles
  for (const transition of asArray(attrs.sharedTransitions)) {
    collectRolesFromTransition(transition, out);
  }

  // cancel / exit / updateData roles
  collectRolesFromTransition(attrs.cancel, out);
  collectRolesFromTransition(attrs.exit, out);
  collectRolesFromTransition(attrs.updateData, out);

  // workflow-level queryRoles (no parallel field exists for labels)
  collectRolesFromArray(attrs.queryRoles, out);
}

function collectLanguagesFromWorkflow(
  workflowJson: unknown,
  resolveComponent: ComponentResolver | undefined,
  visited: Set<string>,
  out: Set<string>,
): void {
  if (!isObject(workflowJson)) return;
  const wf = workflowJson as WorkflowLike;
  const wfKey = asString(wf.key);
  const wfDomain = asString(wf.domain);

  const vk = visitKey(wfDomain, wfKey);
  if (vk) {
    if (visited.has(vk)) return;
    visited.add(vk);
  }

  if (!isObject(wf.attributes)) return;
  const attrs = wf.attributes as AttributesLike;

  // workflow-level labels
  collectLanguagesFromArray(attrs.labels, out);

  // startTransition labels
  collectLanguagesFromTransition(attrs.startTransition, out);

  // states[].labels and states[].transitions[].labels; recurse into subflows
  for (const state of asArray(attrs.states)) {
    if (!isObject(state)) continue;
    const s = state as StateLike;
    collectLanguagesFromArray(s.labels, out);
    for (const transition of asArray(s.transitions)) {
      collectLanguagesFromTransition(transition, out);
    }

    if (resolveComponent && isObject(s.subFlow)) {
      const sf = s.subFlow as { process?: unknown };
      if (isObject(sf.process)) {
        const subWf = resolveSubflow(sf.process as SubFlowProcess, wfDomain, resolveComponent, visited);
        if (subWf) collectLanguagesFromWorkflow(subWf, resolveComponent, visited, out);
      }
    }
  }

  // sharedTransitions[].labels
  for (const transition of asArray(attrs.sharedTransitions)) {
    collectLanguagesFromTransition(transition, out);
  }

  // cancel / exit / updateData labels
  collectLanguagesFromTransition(attrs.cancel, out);
  collectLanguagesFromTransition(attrs.exit, out);
  collectLanguagesFromTransition(attrs.updateData, out);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans all role grants across the workflow JSON (and optionally its
 * same-domain subflow chain) and returns unique role names sorted
 * alphabetically.
 *
 * When `resolveComponent` is provided, same-domain subflows referenced via
 * `states[].subFlow.process` are resolved and scanned recursively. Cross-
 * domain subflows are bypassed. The entire subflow chain is traced; cycle
 * detection prevents infinite loops.
 *
 * Scanned locations (per workflow in the chain):
 * - `attributes.startTransition?.roles[].role`
 * - `attributes.states[].transitions[].roles[].role`
 * - `attributes.sharedTransitions[].roles[].role`
 * - `attributes.cancel?.roles[].role`
 * - `attributes.exit?.roles[].role`
 * - `attributes.updateData?.roles[].role`
 * - `attributes.states[].queryRoles[].role`
 * - `attributes.queryRoles[].role`
 *
 * Note: the `grant` field of each role entry is intentionally ignored — only
 * the role identifier is collected; grant semantics are applied by the caller.
 */
export function collectWorkflowRoles(
  workflowJson: unknown,
  resolveComponent?: ComponentResolver,
): string[] {
  const out = new Set<string>();
  collectRolesFromWorkflow(workflowJson, resolveComponent, new Set<string>(), out);
  return [...out].sort();
}

/**
 * Scans all `labels[].language` values across the workflow JSON (and
 * optionally its same-domain subflow chain) and returns unique language codes
 * sorted alphabetically.
 *
 * When `resolveComponent` is provided, same-domain subflows are followed
 * recursively with the same domain-filter and cycle-detection rules as
 * `collectWorkflowRoles`.
 *
 * Scanned locations (per workflow in the chain):
 * - `attributes.labels[].language`
 * - `attributes.startTransition?.labels[].language`
 * - `attributes.states[].labels[].language`
 * - `attributes.states[].transitions[].labels[].language`
 * - `attributes.sharedTransitions[].labels[].language`
 * - `attributes.cancel?.labels[].language`
 * - `attributes.exit?.labels[].language`
 * - `attributes.updateData?.labels[].language`
 */
export function collectWorkflowLanguages(
  workflowJson: unknown,
  resolveComponent?: ComponentResolver,
): string[] {
  const out = new Set<string>();
  collectLanguagesFromWorkflow(workflowJson, resolveComponent, new Set<string>(), out);
  return [...out].sort();
}
