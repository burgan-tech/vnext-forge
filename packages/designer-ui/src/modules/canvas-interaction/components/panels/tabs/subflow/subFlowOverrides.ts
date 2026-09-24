import type {
  ResourceReference,
  RoleGrant,
  SubFlowConfig,
  SubFlowLongPollOverride,
  SubFlowOverrides,
  SubFlowStateOverride,
} from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';

/**
 * Pure rules for `state.subFlow.overrides` (runtime: vnext
 * docs/domain/subflow-overrides.md). Components render what these return and
 * write through the mutators below inside `updateWorkflow`.
 */

export type SubFlowOverrideSource = Pick<SubFlowConfig, 'overrides' | 'viewOverrides'>;

function overridesOf(sf: SubFlowOverrideSource): SubFlowOverrides {
  return sf.overrides ?? {};
}

export function countOverrides(sf: SubFlowOverrideSource): number {
  const o = overridesOf(sf);
  let n = o.timeout?.key ? 1 : 0;
  for (const entry of Object.values(o.transitions ?? {})) {
    if (entry.roles !== undefined) n += 1;
    n += Object.keys(entry.views ?? {}).length;
  }
  for (const entry of Object.values(o.states ?? {})) {
    if (entry.queryRoles !== undefined) n += 1;
    const longPoll = entry.interaction?.longPoll;
    if (longPoll?.fallbackTimeoutSeconds !== undefined) n += 1;
    if (longPoll?.roles !== undefined) n += 1;
    n += Object.keys(entry.views ?? {}).length;
  }
  return n + Object.keys(legacyViewOverrides(sf)).length;
}

export type OverrideWarningCode =
  | 'roles-empty'
  | 'roles-ignored-rule'
  | 'longpoll-inert'
  | 'legacy-views'
  | 'mixed-views';

export interface OverrideWarning {
  code: OverrideWarningCode;
  message: string;
}

export function legacyViewOverrides(sf: SubFlowOverrideSource): Record<string, ResourceReference> {
  return { ...(sf.viewOverrides ?? {}), ...(overridesOf(sf).views ?? {}) };
}

export function hasLegacyViews(sf: SubFlowOverrideSource): boolean {
  return Object.keys(legacyViewOverrides(sf)).length > 0;
}

function hasScopedViews(o: SubFlowOverrides): boolean {
  const scoped = [...Object.values(o.states ?? {}), ...Object.values(o.transitions ?? {})];
  return scoped.some((entry) => Object.keys(entry.views ?? {}).length > 0);
}

function isEmptyList(roles: RoleGrant[] | undefined): boolean {
  return Array.isArray(roles) && roles.length === 0;
}

export function overrideWarnings(
  sf: SubFlowOverrideSource,
  child: ChildWorkflowSummary | null,
): OverrideWarning[] {
  const o = overridesOf(sf);
  const warnings: OverrideWarning[] = [];

  for (const [key, entry] of Object.entries(o.transitions ?? {})) {
    if (isEmptyList(entry.roles)) {
      warnings.push({
        code: 'roles-empty',
        message: `Transition "${key}" overrides roles with an empty list — every caller is admitted.`,
      });
    }
  }

  for (const [key, entry] of Object.entries(o.states ?? {})) {
    if (isEmptyList(entry.queryRoles)) {
      warnings.push({
        code: 'roles-empty',
        message: `State "${key}" overrides query roles with an empty list — every caller can read it.`,
      });
    }
    const longPoll = entry.interaction?.longPoll;
    if (!longPoll) continue;
    const childState = child?.states.find((s) => s.key === key);
    const usesRule = childState?.longPollAuth === 'rule';
    // The runtime ignores roles on a rule-gated long poll, so an empty list is
    // not "every caller is admitted" there — the rule decides regardless.
    if (isEmptyList(longPoll.roles) && !usesRule) {
      warnings.push({
        code: 'roles-empty',
        message: `State "${key}" overrides long-poll roles with an empty list — every caller can acknowledge.`,
      });
    }
    if (!childState) continue;
    if (childState.longPollAuth === null) {
      warnings.push({
        code: 'longpoll-inert',
        message: `Child state "${key}" declares no long poll — this long-poll override has no effect.`,
      });
    } else if (usesRule && longPoll.roles !== undefined) {
      warnings.push({
        code: 'roles-ignored-rule',
        message: `Child state "${key}" authorizes its long poll with a rule — the roles override is ignored at runtime.`,
      });
    }
  }

  if (hasLegacyViews(sf)) {
    warnings.push({
      code: 'legacy-views',
      message:
        'Legacy view overrides (subFlow.viewOverrides / overrides.views) are deprecated — migrate them to state or transition scoped views.',
    });
    if (hasScopedViews(o)) {
      warnings.push({
        code: 'mixed-views',
        message:
          'Legacy and scoped view overrides are mixed — the runtime rejects this subflow. Migrate or remove the legacy map.',
      });
    }
  }

  return warnings;
}

export interface LegacyViewMigrationPlan {
  states: Record<string, Record<string, ResourceReference>>;
  transitions: Record<string, Record<string, ResourceReference>>;
  unplaced: string[];
}

export function planLegacyViewMigration(
  sf: SubFlowOverrideSource,
  child: ChildWorkflowSummary,
): LegacyViewMigrationPlan {
  const plan: LegacyViewMigrationPlan = { states: {}, transitions: {}, unplaced: [] };
  for (const [viewKey, replacement] of Object.entries(legacyViewOverrides(sf))) {
    let placed = false;
    for (const state of child.states) {
      if (!state.viewKeys.includes(viewKey)) continue;
      (plan.states[state.key] ??= {})[viewKey] = replacement;
      placed = true;
    }
    for (const transition of child.transitions) {
      if (!transition.viewKeys.includes(viewKey)) continue;
      (plan.transitions[transition.key] ??= {})[viewKey] = replacement;
      placed = true;
    }
    if (!placed) plan.unplaced.push(viewKey);
  }
  return plan;
}

/** Existing scoped entries win over migrated legacy ones. */
export function applyLegacyViewMigration(sf: SubFlowConfig, plan: LegacyViewMigrationPlan): void {
  if (plan.unplaced.length > 0) return;
  sf.overrides ??= {};
  const o = sf.overrides;
  for (const [stateKey, views] of Object.entries(plan.states)) {
    o.states ??= {};
    const entry = (o.states[stateKey] ??= {});
    entry.views = { ...views, ...(entry.views ?? {}) };
  }
  for (const [transitionKey, views] of Object.entries(plan.transitions)) {
    o.transitions ??= {};
    const entry = (o.transitions[transitionKey] ??= {});
    entry.views = { ...views, ...(entry.views ?? {}) };
  }
  delete o.views;
  delete sf.viewOverrides;
}

export type FallbackParse = { ok: true; value: number | undefined } | { ok: false };

/** Schema: `fallbackTimeoutSeconds` is an integer, minimum 1. Blank = keep the child value. */
export function parseFallbackSeconds(text: string): FallbackParse {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= 1 ? { ok: true, value } : { ok: false };
}

export interface LongPollOverridePatch {
  fallbackTimeoutSeconds?: number | undefined;
  roles?: RoleGrant[] | undefined;
}

export function setLongPollOverride(entry: SubFlowStateOverride, patch: LongPollOverridePatch): void {
  const longPoll: SubFlowLongPollOverride = { ...(entry.interaction?.longPoll ?? {}) };
  if ('fallbackTimeoutSeconds' in patch) {
    if (patch.fallbackTimeoutSeconds === undefined) delete longPoll.fallbackTimeoutSeconds;
    else longPoll.fallbackTimeoutSeconds = patch.fallbackTimeoutSeconds;
  }
  if ('roles' in patch) {
    if (patch.roles === undefined) delete longPoll.roles;
    else longPoll.roles = patch.roles;
  }
  if (Object.keys(longPoll).length === 0) delete entry.interaction;
  else entry.interaction = { longPoll };
}

export function renameRecordKey<T>(record: Record<string, T>, from: string, to: string): boolean {
  if (from === to || !(from in record) || to in record) return false;
  const entries = Object.entries(record);
  for (const key of Object.keys(record)) delete record[key];
  for (const [key, value] of entries) record[key === from ? to : key] = value;
  return true;
}

export function nextOverrideKey(record: Record<string, unknown>, options: string[], prefix: string): string {
  const free = options.find((option) => !(option in record));
  if (free) return free;
  let index = Object.keys(record).length + 1;
  while (`${prefix}-${index}` in record) index += 1;
  return `${prefix}-${index}`;
}
