import { describe, expect, it } from 'vitest';

import { normalizeRoleEntries } from './RoleGrantListEditor';
import { withEncryptionType } from './XEncryptionCard';
import { withMaskingOperator } from './XMaskingCard';

describe('normalizeRoleEntries', () => {
  it('keeps allOf / anyOf grants instead of flattening them', () => {
    expect(
      normalizeRoleEntries([
        { allOf: [{ role: 'a' }, { role: 'b' }], grant: 'deny' },
        { anyOf: [{ role: 'c' }], grant: 'allow' },
        { role: 'x', grant: 'allow' },
      ]),
    ).toEqual([
      { allOf: [{ role: 'a' }, { role: 'b' }], grant: 'deny' },
      { anyOf: [{ role: 'c' }], grant: 'allow' },
      { role: 'x', grant: 'allow' },
    ]);
  });

  it('coerces exemption lists to plain allow grants', () => {
    expect(normalizeRoleEntries([{ role: 'a', grant: 'deny' }], { allowOnly: true })).toEqual([{ role: 'a', grant: 'allow' }]);
  });
});

describe('withEncryptionType', () => {
  it('keeps params on hash only and roles on encrypt only', () => {
    expect(withEncryptionType({ type: 'hash', params: { algorithm: 'sha512' }, purpose: 'p' }, 'encrypt')).toEqual({
      type: 'encrypt',
      purpose: 'p',
    });
    expect(withEncryptionType({ type: 'encrypt', roles: [{ role: 'a', grant: 'allow' }] }, 'hash')).toEqual({ type: 'hash' });
    expect(withEncryptionType({ type: 'transport' }, 'none')).toEqual({ type: 'none' });
  });
});

describe('withMaskingOperator', () => {
  it('gives replace a value and mask its own params', () => {
    expect(withMaskingOperator({ operator: 'mask', params: { keepLast: 4 } }, 'replace')).toEqual({
      operator: 'replace',
      params: { value: '***' },
    });
    expect(withMaskingOperator({ operator: 'replace', params: { value: 'x' } }, 'mask')).toEqual({ operator: 'mask' });
  });
});
