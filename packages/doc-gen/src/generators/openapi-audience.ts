/**
 * Utilities for collecting audience metadata (roles, languages) from a
 * workflow JSON document.  These are used to populate UI pickers such as
 * the AudienceRolePickerDialog.
 *
 * All functions accept `unknown` input and apply defensive type assertions —
 * the caller is not required to pre-validate the shape.
 */

// ---------------------------------------------------------------------------
// Internal type helpers (not exported)
// ---------------------------------------------------------------------------

interface RoleGrant {
  role?: unknown;
  grant?: unknown;
}

interface LabelEntry {
  language?: unknown;
  label?: unknown;
}

interface TransitionLike {
  roles?: unknown;
  labels?: unknown;
}

interface StateLike {
  transitions?: unknown;
  labels?: unknown;
  queryRoles?: unknown;
}

interface AttributesLike {
  labels?: unknown;
  startTransition?: unknown;
  states?: unknown;
  sharedTransitions?: unknown;
  cancel?: unknown;
  exit?: unknown;
  updateData?: unknown;
}

interface WorkflowLike {
  attributes?: unknown;
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans all role grants across the entire workflow JSON and returns unique
 * role names sorted alphabetically.
 *
 * Scanned locations:
 * - `attributes.startTransition?.roles[].role`
 * - `attributes.states[].transitions[].roles[].role`
 * - `attributes.sharedTransitions[].roles[].role`
 * - `attributes.cancel?.roles[].role`
 * - `attributes.exit?.roles[].role`
 * - `attributes.updateData?.roles[].role`
 * - `attributes.states[].queryRoles[].role`
 */
export function collectWorkflowRoles(workflowJson: unknown): string[] {
  const out = new Set<string>();

  if (!isObject(workflowJson)) return [];
  const wf = workflowJson as WorkflowLike;
  if (!isObject(wf.attributes)) return [];
  const attrs = wf.attributes as AttributesLike;

  // startTransition roles
  collectRolesFromTransition(attrs.startTransition, out);

  // states[].transitions[].roles and states[].queryRoles
  for (const state of asArray(attrs.states)) {
    if (!isObject(state)) continue;
    const s = state as StateLike;
    for (const transition of asArray(s.transitions)) {
      collectRolesFromTransition(transition, out);
    }
    collectRolesFromArray(s.queryRoles, out);
  }

  // sharedTransitions[].roles
  for (const transition of asArray(attrs.sharedTransitions)) {
    collectRolesFromTransition(transition, out);
  }

  // cancel / exit / updateData roles
  collectRolesFromTransition(attrs.cancel, out);
  collectRolesFromTransition(attrs.exit, out);
  collectRolesFromTransition(attrs.updateData, out);

  return [...out].sort();
}

/**
 * Scans all `labels[].language` values across the workflow JSON and returns
 * unique language codes sorted alphabetically.
 *
 * Scanned locations:
 * - `attributes.labels[].language`
 * - `attributes.startTransition?.labels[].language`
 * - `attributes.states[].labels[].language`
 * - `attributes.states[].transitions[].labels[].language`
 * - `attributes.sharedTransitions[].labels[].language`
 * - `attributes.cancel?.labels[].language`
 * - `attributes.exit?.labels[].language`
 * - `attributes.updateData?.labels[].language`
 */
export function collectWorkflowLanguages(workflowJson: unknown): string[] {
  const out = new Set<string>();

  if (!isObject(workflowJson)) return [];
  const wf = workflowJson as WorkflowLike;
  if (!isObject(wf.attributes)) return [];
  const attrs = wf.attributes as AttributesLike;

  // workflow-level labels
  collectLanguagesFromArray(attrs.labels, out);

  // startTransition labels
  collectLanguagesFromTransition(attrs.startTransition, out);

  // states[].labels and states[].transitions[].labels
  for (const state of asArray(attrs.states)) {
    if (!isObject(state)) continue;
    const s = state as StateLike;
    collectLanguagesFromArray(s.labels, out);
    for (const transition of asArray(s.transitions)) {
      collectLanguagesFromTransition(transition, out);
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

  return [...out].sort();
}
