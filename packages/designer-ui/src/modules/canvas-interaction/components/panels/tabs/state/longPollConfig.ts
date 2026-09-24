import type {
  LongPollConfig,
  LongPollRuleArm,
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
