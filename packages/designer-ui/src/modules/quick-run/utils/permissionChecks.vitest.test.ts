import { describe, expect, it, vi } from 'vitest';

import type { AuthorizeTarget } from '../types/quickrun.types';
import {
  buildAuthorizeTarget,
  checkableTransitionKeys,
  permissionCacheKey,
  resolveVerdict,
  runPermissionChecks,
  verdictText,
  visibilityText,
} from './permissionChecks';

describe('permissionCacheKey', () => {
  it('keys by eTag and role, falling back to the state when there is no eTag', () => {
    expect(permissionCacheKey('W/"e1"', 'i1:s', 'approver')).toBe('W/"e1"|approver');
    expect(permissionCacheKey(undefined, 'i1:s', undefined)).toBe('state:i1:s|');
  });
});

describe('checkableTransitionKeys', () => {
  it('lists state and shared transitions once, without scheduled entries', () => {
    expect(
      checkableTransitionKeys(
        [
          { name: 'approve', href: '' },
          { name: 'remind', href: '', kind: 'scheduled' },
        ],
        [
          { name: 'cancel', href: '', kind: 'cancel' },
          { name: 'approve', href: '' },
        ],
      ),
    ).toEqual(['approve', 'cancel']);
  });
});

describe('resolveVerdict', () => {
  it('maps success, failure and throws', async () => {
    expect(await resolveVerdict(Promise.resolve({ success: true, data: { allowed: false, status: 403 } }))).toEqual({
      kind: 'verdict',
      allowed: false,
      status: 403,
    });
    expect(await resolveVerdict(Promise.resolve({ success: false, error: { message: 'HTTP 500' } }))).toEqual({
      kind: 'error',
      message: 'HTTP 500',
    });
    expect(await resolveVerdict(Promise.reject(new Error('offline')))).toEqual({ kind: 'error', message: 'offline' });
  });
});

describe('runPermissionChecks', () => {
  it('asks queryRoles once and each transition once, with the role', async () => {
    const authorize = vi.fn((target: AuthorizeTarget) =>
      Promise.resolve({
        success: true as const,
        data: target.kind === 'transition' && target.transitionKey === 'reject'
          ? { allowed: false, status: 403 }
          : { allowed: true, status: 200 },
      }),
    );
    const result = await runPermissionChecks({ key: 'k', role: 'approver', transitionKeys: ['approve', 'reject', 'approve'], authorize });
    expect(authorize).toHaveBeenCalledTimes(3);
    expect(authorize).toHaveBeenCalledWith({ kind: 'queryRoles' }, 'approver');
    expect(result).toEqual({
      key: 'k',
      role: 'approver',
      queryRoles: { kind: 'verdict', allowed: true, status: 200 },
      transitions: {
        approve: { kind: 'verdict', allowed: true, status: 200 },
        reject: { kind: 'verdict', allowed: false, status: 403 },
      },
    });
  });
});

describe('texts', () => {
  it('describes verdicts and visibility', () => {
    expect(verdictText({ kind: 'verdict', allowed: true, status: 200 })).toBe('Allowed (HTTP 200)');
    expect(verdictText({ kind: 'verdict', allowed: false, status: 403 })).toBe('Denied (HTTP 403)');
    expect(verdictText({ kind: 'error', message: 'x' })).toBe('Check failed: x');
    expect(visibilityText({ kind: 'verdict', allowed: true, status: 200 })).toBe('Instance visible to this role');
    expect(visibilityText({ kind: 'verdict', allowed: false, status: 403 })).toBe('Instance hidden from this role');
  });
});

describe('buildAuthorizeTarget', () => {
  it('needs a key for transition and function targets only', () => {
    expect(buildAuthorizeTarget('transition', '')).toBeNull();
    expect(buildAuthorizeTarget('transition', 'approve')).toEqual({ kind: 'transition', transitionKey: 'approve' });
    expect(buildAuthorizeTarget('function', 'f')).toEqual({ kind: 'function', functionKey: 'f' });
    expect(buildAuthorizeTarget('queryRoles', '')).toEqual({ kind: 'queryRoles' });
    expect(buildAuthorizeTarget('ack', '')).toEqual({ kind: 'ack' });
  });
});
