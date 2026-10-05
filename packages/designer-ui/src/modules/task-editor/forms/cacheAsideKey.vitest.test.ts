import { describe, expect, it } from 'vitest';

import { cacheKeyMode, keyForMode, migrateKeyExpression } from './cacheAsideKey';

describe('CacheAside key (runtime 0.0.99)', () => {
  it('detects the key mode', () => {
    expect(cacheKeyMode(undefined)).toBe('none');
    expect(cacheKeyMode('static:key')).toBe('static');
    expect(cacheKeyMode({ location: 'dynamicExpresso', code: 'x' })).toBe('expression');
    expect(cacheKeyMode({ location: './src/Key.csx', code: 'b64' })).toBe('script');
  });

  it('carries a static key into an expression as a string literal', () => {
    expect(keyForMode('abc', 'expression')).toEqual({ location: 'dynamicExpresso', code: '"abc"', encoding: 'NAT' });
    expect(keyForMode({ location: 'dynamicExpresso', code: 'x' }, 'none')).toBeUndefined();
  });

  it('migrates keyExpression into key and drops it', () => {
    const config: Record<string, unknown> = {
      keyExpression: { location: 'dynamicExpresso', code: '"c:" + context.Headers.id', encoding: 'NAT' },
    };
    expect(migrateKeyExpression(config)).toBe(true);
    expect(config).toEqual({ key: { location: 'dynamicExpresso', code: '"c:" + context.Headers.id', encoding: 'NAT' } });
  });

  it('decodes a base64 keyExpression', () => {
    const config: Record<string, unknown> = { keyExpression: { code: btoa('"k"'), encoding: 'B64' } };
    migrateKeyExpression(config);
    expect(config.key).toEqual({ location: 'dynamicExpresso', code: '"k"', encoding: 'NAT' });
  });

  it('is a no-op without keyExpression', () => {
    const config: Record<string, unknown> = { key: 'k' };
    expect(migrateKeyExpression(config)).toBe(false);
    expect(config).toEqual({ key: 'k' });
  });
});
