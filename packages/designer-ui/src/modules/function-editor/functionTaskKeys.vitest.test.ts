import { describe, expect, it } from 'vitest';
import { findTaskKeyCollisions, toVariableName } from './functionTaskKeys';

describe('toVariableName (runtime StringExtensions.ToVariableName)', () => {
  it('camel-cases hyphen, underscore and space separated keys', () => {
    expect(toVariableName('user-info')).toBe('userInfo');
    expect(toVariableName('user_info')).toBe('userInfo');
    expect(toVariableName('User-INFO')).toBe('userInfo');
    expect(toVariableName('send otp code')).toBe('sendOtpCode');
  });

  it('prefixes an underscore when the name would not start with a letter', () => {
    expect(toVariableName('2fa-check')).toBe('_2faCheck');
  });

  it('returns blank input unchanged', () => {
    expect(toVariableName('')).toBe('');
    expect(toVariableName('--')).toBe('--');
  });
});

describe('findTaskKeyCollisions', () => {
  it('reports later entries whose key normalizes to an earlier one', () => {
    expect(
      findTaskKeyCollisions([
        { order: 1, task: { key: 'user-info' } },
        { order: 2, task: { key: 'send-otp' } },
        { order: 3, task: { key: 'user_info' } },
        { order: 4, task: { key: 'user-info' } },
      ]),
    ).toEqual([
      { index: 2, key: 'user_info', collidesWith: 'user-info', variableName: 'userInfo' },
      { index: 3, key: 'user-info', collidesWith: 'user-info', variableName: 'userInfo' },
    ]);
  });

  it('skips entries without a task key', () => {
    expect(findTaskKeyCollisions([{ order: 1 }, { order: 2, task: { key: ' ' } }, null])).toEqual([]);
  });
});
