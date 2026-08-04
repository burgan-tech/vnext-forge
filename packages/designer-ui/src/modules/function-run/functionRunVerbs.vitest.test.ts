import { describe, expect, it } from 'vitest';

import { defaultVerbFor, resolveVerbs } from './functionRunVerbs';

describe('resolveVerbs', () => {
  it('uses the declared verbs', () => {
    expect(resolveVerbs(['GET', 'POST'])).toEqual(['GET', 'POST']);
  });

  it('falls back to all four when the contract declares none', () => {
    // "When omitted or empty, no verb restriction is applied."
    expect(resolveVerbs(undefined)).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
    expect(resolveVerbs([])).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
  });

  it('drops verbs outside the contract enum and keeps canonical order', () => {
    expect(resolveVerbs(['DELETE', 'PUT', 'GET'])).toEqual(['GET', 'DELETE']);
  });

  it('falls back when every declared verb is unknown', () => {
    expect(resolveVerbs(['PUT', 'HEAD'])).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
  });

  it('de-duplicates a declared verb that repeats', () => {
    // Malformed `attributes.verbs` (hand-edited JSON) could repeat a verb;
    // the result must still be the canonical set with no duplicate entries.
    expect(resolveVerbs(['GET', 'GET', 'POST'])).toEqual(['GET', 'POST']);
  });

  it('ignores non-string entries rather than throwing', () => {
    // `declared` is typed as `readonly string[]`, but a hand-edited contract
    // JSON can put anything in an array. This must degrade to "unknown verb",
    // not crash the runner.
    expect(resolveVerbs([123, null, 'GET'] as unknown as string[])).toEqual(['GET']);
  });

  it('falls back when declared is not an array at all', () => {
    expect(resolveVerbs('GET' as unknown as string[])).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
  });
});

describe('defaultVerbFor', () => {
  it('prefers GET when available', () => {
    expect(defaultVerbFor(['POST', 'GET'])).toBe('GET');
  });

  it('otherwise takes the first', () => {
    expect(defaultVerbFor(['POST', 'PATCH'])).toBe('POST');
  });
});
