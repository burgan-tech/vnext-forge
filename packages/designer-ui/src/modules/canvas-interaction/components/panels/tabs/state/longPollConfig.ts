import type {
  LongPollConfig,
  LongPollRuleArm,
  MappingCode,
  RoleGrant,
} from '@vnext-forge-studio/vnext-types';

/**
 * Pure helpers for `state.interaction.longPoll`. The schema requires exactly
 * one authorization arm (`roles` XOR `rule`); these helpers are the only
 * writers so the editor can never produce both.
 */

export interface LongPollPatch {
  terminate?: boolean;
  /** Present-with-undefined clears the field. */
  fallbackTimeoutSeconds?: number | undefined;
  /** Ignored on a rule arm. */
  roles?: RoleGrant[];
}

export function isRuleArm(lp: LongPollConfig): lp is LongPollRuleArm {
  return (lp as LongPollRuleArm).rule !== undefined;
}

export function makeEmptyLongPoll(): LongPollConfig {
  // Seed one role row so the user can type straight away.
  return { terminate: true, roles: [{ role: '', grant: 'allow' }] };
}

export function patchLongPoll(base: LongPollConfig | null, patch: LongPollPatch): LongPollConfig {
  const current = base ?? makeEmptyLongPoll();
  const terminate = patch.terminate ?? current.terminate;
  const fallback =
    'fallbackTimeoutSeconds' in patch ? patch.fallbackTimeoutSeconds : current.fallbackTimeoutSeconds;
  const common = fallback === undefined ? { terminate } : { terminate, fallbackTimeoutSeconds: fallback };

  if (isRuleArm(current)) return { ...common, rule: current.rule };
  return { ...common, roles: patch.roles ?? current.roles };
}

export type LongPollArm = 'roles' | 'rule';
export type LongPollArmIssue = 'both' | 'neither';

/** A rule arm without a script yet — CsxEditorField shows its create buttons. */
export const EMPTY_RULE: MappingCode = { location: '', code: '' };

function commonFields(lp: LongPollConfig): { terminate: boolean; fallbackTimeoutSeconds?: number } {
  return lp.fallbackTimeoutSeconds === undefined
    ? { terminate: lp.terminate }
    : { terminate: lp.terminate, fallbackTimeoutSeconds: lp.fallbackTimeoutSeconds };
}

export function currentLongPollArm(lp: LongPollConfig): LongPollArm {
  return isRuleArm(lp) ? 'rule' : 'roles';
}

/**
 * Moves the long poll to `arm`, clearing the other arm. The chosen arm keeps
 * its existing value when the document already carries one (a hand-edited
 * document can hold both); otherwise it starts empty.
 */
export function switchLongPollArm(lp: LongPollConfig, arm: LongPollArm): LongPollConfig {
  const common = commonFields(lp);
  if (arm === 'rule') {
    const rule = (lp as { rule?: MappingCode }).rule;
    return { ...common, rule: rule ?? { ...EMPTY_RULE } };
  }
  const roles = (lp as { roles?: RoleGrant[] }).roles;
  return { ...common, roles: Array.isArray(roles) ? roles : [] };
}

export function setLongPollRule(lp: LongPollConfig, rule: MappingCode): LongPollConfig {
  return { ...commonFields(lp), rule };
}

/**
 * `both`: roles and rule are present (schema `oneOf` violation).
 * `neither`: no arm, or a rule arm whose script is still empty.
 */
export function longPollArmIssue(lp: LongPollConfig): LongPollArmIssue | null {
  const rec = lp as { roles?: unknown; rule?: MappingCode };
  const hasRoles = rec.roles !== undefined;
  const hasRule = rec.rule !== undefined;
  if (hasRoles && hasRule) return 'both';
  if (!hasRoles && !hasRule) return 'neither';
  if (hasRule && !rec.rule?.code) return 'neither';
  return null;
}
