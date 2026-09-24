import { describe, expect, it } from 'vitest';
import type { LongPollConfig } from '@vnext-forge-studio/vnext-types';
import { isRuleArm, makeEmptyLongPoll, patchLongPoll } from './longPollConfig';

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
