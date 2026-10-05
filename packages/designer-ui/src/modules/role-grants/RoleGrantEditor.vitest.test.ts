import { describe, expect, it } from 'vitest';
import { describeRoleGrant, leafRoles, roleGrantMode } from '@vnext-forge-studio/vnext-types';

import { switchRoleGrantMode } from './RoleGrantEditor';

describe('switchRoleGrantMode', () => {
  it('turns a single role into an allOf carrying that role', () => {
    expect(switchRoleGrantMode({ role: 'maker', grant: 'deny' }, 'allOf')).toEqual({
      allOf: [{ role: 'maker' }],
      grant: 'deny',
    });
  });

  it('moves conditions between allOf and anyOf', () => {
    const next = switchRoleGrantMode({ allOf: [{ role: 'a' }, { role: 'b' }], grant: 'allow' }, 'anyOf');
    expect(next).toEqual({ anyOf: [{ role: 'a' }, { role: 'b' }], grant: 'allow' });
  });

  it('keeps the first role when collapsing to a single role', () => {
    expect(switchRoleGrantMode({ anyOf: [{ role: 'a' }, { role: 'b' }], grant: 'allow' }, 'role')).toEqual({
      role: 'a',
      grant: 'allow',
    });
  });

  it('seeds an empty condition for an empty role', () => {
    expect(switchRoleGrantMode({ role: '', grant: 'allow' }, 'anyOf')).toEqual({
      anyOf: [{ role: '' }],
      grant: 'allow',
    });
  });
});

describe('role grant helpers', () => {
  it('detect the mode, list leaf roles and describe the grant', () => {
    const g = { allOf: [{ role: 'a' }, { role: 'b' }], grant: 'allow' as const };
    expect(roleGrantMode(g)).toBe('allOf');
    expect(leafRoles(g)).toEqual(['a', 'b']);
    expect(describeRoleGrant(g)).toBe('all of (a, b)');
    expect(describeRoleGrant({ role: 'x', grant: 'deny' })).toBe('x');
  });
});
