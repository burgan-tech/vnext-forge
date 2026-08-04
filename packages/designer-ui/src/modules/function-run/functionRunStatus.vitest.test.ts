import { describe, expect, it } from 'vitest';

import { classifyStatus, isAuthorizationFailure } from './functionRunStatus';

describe('classifyStatus', () => {
  it('classifies each class at its boundaries', () => {
    expect(classifyStatus(199)).toBe('informational');
    expect(classifyStatus(200)).toBe('success');
    expect(classifyStatus(299)).toBe('success');
    expect(classifyStatus(300)).toBe('redirect');
    expect(classifyStatus(399)).toBe('redirect');
    expect(classifyStatus(400)).toBe('client-error');
    expect(classifyStatus(499)).toBe('client-error');
    expect(classifyStatus(500)).toBe('server-error');
  });

  it('never throws on a status outside the valid HTTP range', () => {
    // A proxy or a function under development could hand back something
    // nonsensical; the runner must still render a banner, not crash.
    expect(classifyStatus(0)).toBe('informational');
    expect(classifyStatus(-1)).toBe('informational');
    expect(classifyStatus(Number.NaN)).toBe('informational');
  });
});

describe('isAuthorizationFailure', () => {
  it('detects the two statuses that mean "you may not run this"', () => {
    expect(isAuthorizationFailure(401)).toBe(true);
    expect(isAuthorizationFailure(403)).toBe(true);
  });

  it('does not treat other client errors as authorization failures', () => {
    // 404 means "no sys-functions component", not a permission problem.
    expect(isAuthorizationFailure(404)).toBe(false);
    expect(isAuthorizationFailure(422)).toBe(false);
    expect(isAuthorizationFailure(200)).toBe(false);
  });
});
