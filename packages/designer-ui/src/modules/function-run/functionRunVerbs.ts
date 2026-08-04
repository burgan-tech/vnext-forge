import { FUNCTION_VERBS, type FunctionVerb } from '@vnext-forge-studio/vnext-types';

/**
 * Verbs the runner offers. An absent or empty `verbs` means "no verb
 * restriction", so the runner offers all four rather than none.
 *
 * `declared` comes straight from a component's `attributes.verbs`, which is
 * hand-editable JSON — it may not even be an array at runtime, and any
 * entries it does have may repeat or be the wrong type. Filtering
 * `FUNCTION_VERBS` (rather than mapping `declared`) is what keeps the
 * result de-duplicated and in canonical order for free: each of the four
 * known verbs is considered at most once, regardless of how `declared` is
 * shaped.
 */
export function resolveVerbs(declared: readonly string[] | undefined): FunctionVerb[] {
  const known = Array.isArray(declared) ? FUNCTION_VERBS.filter((verb) => declared.includes(verb)) : [];
  return known.length > 0 ? [...known] : [...FUNCTION_VERBS];
}

/** GET is the safest default — it cannot mutate anything. */
export function defaultVerbFor(verbs: readonly FunctionVerb[]): FunctionVerb {
  return verbs.includes('GET') ? 'GET' : (verbs[0] ?? 'GET');
}
