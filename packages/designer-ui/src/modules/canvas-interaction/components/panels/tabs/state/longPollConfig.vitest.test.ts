import { describe, expect, it } from 'vitest';
import type { LongPollConfig } from '@vnext-forge-studio/vnext-types';
import {
  currentLongPollArm,
  isRuleArm,
  longPollArmIssue,
  makeEmptyLongPoll,
  patchLongPoll,
  setLongPollRule,
  switchLongPollArm,
} from './longPollConfig';

const RULE = { location: './src/Rule.csx', code: 'cmV0dXJuIHRydWU7' };

describe('longPollConfig', () => {
  it('seeds a roles arm with one editable row', () => {
    expect(makeEmptyLongPoll()).toEqual({ terminate: true, roles: [{ role: '', grant: 'allow' }] });
  });

  it('replaces roles on a roles arm', () => {
    const next = patchLongPoll({ terminate: true, roles: [] }, { roles: [{ role: 'a', grant: 'allow' }] });
    expect(next).toEqual({ terminate: true, roles: [{ role: 'a', grant: 'allow' }] });
  });

  it('never writes roles next to a rule', () => {
    const base: LongPollConfig = { terminate: true, rule: RULE };
    const next = patchLongPoll(base, { terminate: false, roles: [{ role: 'x', grant: 'allow' }] });
    expect(next).toEqual({ terminate: false, rule: RULE });
    expect('roles' in next).toBe(false);
  });

  it('drops fallbackTimeoutSeconds when cleared', () => {
    const next = patchLongPoll(
      { terminate: true, fallbackTimeoutSeconds: 30, roles: [] },
      { fallbackTimeoutSeconds: undefined },
    );
    expect(next).toEqual({ terminate: true, roles: [] });
  });

  it('keeps fallbackTimeoutSeconds when the patch does not mention it', () => {
    const next = patchLongPoll({ terminate: true, fallbackTimeoutSeconds: 30, roles: [] }, { terminate: false });
    expect(next).toEqual({ terminate: false, fallbackTimeoutSeconds: 30, roles: [] });
  });

  it('starts from an empty roles arm when there is no base', () => {
    expect(patchLongPoll(null, { terminate: false })).toEqual({
      terminate: false,
      roles: [{ role: '', grant: 'allow' }],
    });
  });

  it('detects the rule arm', () => {
    expect(isRuleArm({ terminate: true, rule: RULE })).toBe(true);
    expect(isRuleArm({ terminate: true, roles: [] })).toBe(false);
  });
});

describe('long-poll arm switching', () => {
  const ROLES = [{ role: 'ovr.child-ack', grant: 'allow' as const }];

  it('switching to Rule drops roles and seeds an empty rule', () => {
    expect(switchLongPollArm({ terminate: true, fallbackTimeoutSeconds: 30, roles: ROLES }, 'rule')).toEqual({
      terminate: true,
      fallbackTimeoutSeconds: 30,
      rule: { location: '', code: '' },
    });
  });

  it('switching to Roles drops the rule and starts with no grants', () => {
    expect(switchLongPollArm({ terminate: false, rule: RULE }, 'roles')).toEqual({ terminate: false, roles: [] });
  });

  it('keeps the chosen arm value and clears the other when both are present', () => {
    const both = { terminate: true, roles: ROLES, rule: RULE } as unknown as LongPollConfig;
    expect(switchLongPollArm(both, 'rule')).toEqual({ terminate: true, rule: RULE });
    expect(switchLongPollArm(both, 'roles')).toEqual({ terminate: true, roles: ROLES });
  });

  it('setLongPollRule replaces the rule and keeps terminate and fallback', () => {
    const next = setLongPollRule({ terminate: true, fallbackTimeoutSeconds: 90, rule: { location: '', code: '' } }, RULE);
    expect(next).toEqual({ terminate: true, fallbackTimeoutSeconds: 90, rule: RULE });
  });

  it('reports the current arm', () => {
    expect(currentLongPollArm({ terminate: true, roles: [] })).toBe('roles');
    expect(currentLongPollArm({ terminate: true, rule: RULE })).toBe('rule');
  });

  it('flags both arms, no arm, and a rule without a script', () => {
    expect(longPollArmIssue({ terminate: true, roles: ROLES, rule: RULE } as unknown as LongPollConfig)).toBe('both');
    expect(longPollArmIssue({ terminate: true } as unknown as LongPollConfig)).toBe('neither');
    expect(longPollArmIssue({ terminate: true, rule: { location: '', code: '' } })).toBe('neither');
    expect(longPollArmIssue({ terminate: true, roles: [] })).toBeNull();
    expect(longPollArmIssue({ terminate: true, rule: RULE })).toBeNull();
  });
});
