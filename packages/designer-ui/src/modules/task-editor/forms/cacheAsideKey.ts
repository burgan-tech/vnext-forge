/**
 * CacheAside `config.key` (runtime 0.0.99 / vnext-schema 0.0.55): a literal
 * string, or a ScriptCode — `location: 'dynamicExpresso'` is a Dynamic
 * Expresso expression, any other location a C# `ICacheKeyMapping`. Absent
 * when the task-level mapping calls `SetCacheKey`. `keyExpression` was removed
 * (the schema rejects it, the runtime ignores it).
 */
export type CacheKeyMode = 'none' | 'static' | 'expression' | 'script';

export function cacheKeyMode(key: unknown): CacheKeyMode {
  if (typeof key === 'string') return 'static';
  if (key && typeof key === 'object') {
    return (key as { location?: unknown }).location === 'dynamicExpresso' ? 'expression' : 'script';
  }
  return 'none';
}

/** The `key` to store when the user switches to `mode`, keeping what carries over. */
export function keyForMode(key: unknown, mode: CacheKeyMode): unknown {
  const current = cacheKeyMode(key);
  if (current === mode) return key;
  switch (mode) {
    case 'none':
      return undefined;
    case 'static':
      return '';
    case 'expression': {
      const code = typeof key === 'string' && key ? JSON.stringify(key) : '';
      return { location: 'dynamicExpresso', code, encoding: 'NAT' };
    }
    case 'script':
      // CsxEditorField seeds the template when the slot is empty.
      return undefined;
  }
}

/**
 * Moves a pre-0.0.99 `keyExpression` into `key` as a Dynamic Expresso
 * ScriptCode (plain text needs `encoding: 'NAT'`). The expression replaces
 * a static `key`, as it overrode that key at run time before. Returns false
 * when there is nothing to migrate.
 */
export function migrateKeyExpression(config: Record<string, unknown>): boolean {
  const expr = config.keyExpression as { code?: unknown; encoding?: unknown; location?: unknown } | undefined;
  if (!expr || typeof expr !== 'object') return false;
  const code = typeof expr.code === 'string' ? expr.code : '';
  const nativeCode = expr.encoding === 'B64' && code ? safeAtob(code) : code;
  if (nativeCode) {
    config.key = { location: 'dynamicExpresso', code: nativeCode, encoding: 'NAT' };
  }
  delete config.keyExpression;
  return true;
}

function safeAtob(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
}
