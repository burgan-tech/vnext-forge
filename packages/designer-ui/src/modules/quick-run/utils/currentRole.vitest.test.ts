import { describe, expect, it } from 'vitest';

import { currentRoleFromHeaders, withRoleHeaders } from './currentRole';

describe('currentRoleFromHeaders', () => {
  it('reads the role header case-insensitively', () => {
    expect(currentRoleFromHeaders({ Role: ' approver ' })).toBe('approver');
  });

  it('falls back to the first x-roles entry', () => {
    expect(currentRoleFromHeaders({ 'X-Roles': ' , viewer, admin' })).toBe('viewer');
  });

  it('returns undefined when neither header carries a value', () => {
    expect(currentRoleFromHeaders(undefined)).toBeUndefined();
    expect(currentRoleFromHeaders({ role: '  ' })).toBeUndefined();
  });
});

describe('withRoleHeaders', () => {
  it('replaces every spelling of role / x-roles with the picked role', () => {
    expect(withRoleHeaders({ Role: 'a', 'x-ROLES': 'a,b', auth: 't' }, 'ht-approver')).toEqual({
      auth: 't',
      role: 'ht-approver',
      'x-roles': 'ht-approver',
    });
  });

  it('leaves the headers alone for an empty role', () => {
    expect(withRoleHeaders({ role: 'a' }, ' ')).toEqual({ role: 'a' });
  });
});
