/**
 * Shared vocabulary for the data-vocab context annotations
 * (`x-context-source`, `x-context-target`). Both cards select from the same
 * boundary/storage enums, so the types + option lists live here once instead
 * of being duplicated per card.
 */

export type ContextBoundary = 'device' | 'user' | 'subject';
export type ContextStorage = 'memory' | 'local' | 'secure';

export const CONTEXT_BOUNDARIES: readonly ContextBoundary[] = ['device', 'user', 'subject'];
export const CONTEXT_STORAGES: readonly ContextStorage[] = ['memory', 'local', 'secure'];

export function isContextBoundary(value: string): value is ContextBoundary {
  return (CONTEXT_BOUNDARIES as readonly string[]).includes(value);
}

export function isContextStorage(value: string): value is ContextStorage {
  return (CONTEXT_STORAGES as readonly string[]).includes(value);
}
