import { describe, expect, it } from 'vitest';
import { applyFunctionCacheTtlChange } from './WorkflowConfigSection.js';

// `WorkflowConfigSection` reads `useWorkflowStore()` directly (no props), and
// zustand's `useSyncExternalStore`-backed hook falls back to its initial
// snapshot under `renderToStaticMarkup` (no `window`), so any store value set
// via `setState` before render is invisible to the component in this SSR
// test environment. That makes store-driven rendering assertions unreliable
// here — see sibling sections for the same constraint. The pure prune/collapse
// logic is extracted into `applyFunctionCacheTtlChange` specifically so it can
// be unit-tested directly, which is the higher-value test for this section.
describe('applyFunctionCacheTtlChange', () => {
  it('sets ttlSeconds on an initially undefined config', () => {
    const next = applyFunctionCacheTtlChange(undefined, '60');
    expect(next).toEqual({ functionCache: { ttlSeconds: 60 } });
  });

  it('updates ttlSeconds on an existing config', () => {
    const next = applyFunctionCacheTtlChange({ functionCache: { ttlSeconds: 60 } }, '120');
    expect(next).toEqual({ functionCache: { ttlSeconds: 120 } });
  });

  it('prunes ttlSeconds, then functionCache, then config back to undefined on empty input', () => {
    const withTtl = applyFunctionCacheTtlChange(undefined, '60');
    expect(withTtl).toEqual({ functionCache: { ttlSeconds: 60 } });

    const cleared = applyFunctionCacheTtlChange(withTtl, '');
    expect(cleared).toBeUndefined();
  });

  it('treats non-finite or sub-1 values as clearing the TTL (host default)', () => {
    expect(applyFunctionCacheTtlChange({ functionCache: { ttlSeconds: 60 } }, 'abc')).toBeUndefined();
    expect(applyFunctionCacheTtlChange({ functionCache: { ttlSeconds: 60 } }, '0')).toBeUndefined();
    expect(applyFunctionCacheTtlChange({ functionCache: { ttlSeconds: 60 } }, '-5')).toBeUndefined();
  });

  it('rejects non-integer TTL input (schema types ttlSeconds as integer)', () => {
    expect(applyFunctionCacheTtlChange({ functionCache: { ttlSeconds: 60 } }, '1.5')).toBeUndefined();
    expect(applyFunctionCacheTtlChange(undefined, '1.5')).toBeUndefined();
  });

  it('preserves sibling config keys when pruning functionCache', () => {
    const next = applyFunctionCacheTtlChange(
      { functionCache: { ttlSeconds: 60 }, otherSetting: true } as Record<string, unknown>,
      '',
    );
    expect(next).toEqual({ otherSetting: true });
  });

  it('produces JSON with no lingering undefined-valued keys', () => {
    const next = applyFunctionCacheTtlChange(undefined, '60');
    expect(JSON.stringify(next)).toBe('{"functionCache":{"ttlSeconds":60}}');
  });
});
