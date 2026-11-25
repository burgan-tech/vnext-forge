/**
 * Adapter for owners that store a task binding's mapping members under other names — the CacheAside
 * task config keeps them as `sourceMapping` / `sourceInput` / `sourceOutput` (vnext-schema task type 18).
 *
 * `readRenamedBinding` builds the `{ mapping, input, output }` view that `TaskBindingMappingField` and
 * `DeclarativeMappingEditor` edit; `applyRenamedBinding` runs an updater on that view and writes the
 * result back under the owner's names. Members the updater did not touch keep their value and their
 * position; a member the updater dropped is deleted; nothing else on the owner is read or written.
 */
import type { MappingBindingLike } from './declarativeMapping';

export interface RenamedBindingMembers {
  mapping: string;
  input: string;
  output: string;
}

export const CACHE_ASIDE_SOURCE_MEMBERS: RenamedBindingMembers = {
  mapping: 'sourceMapping',
  input: 'sourceInput',
  output: 'sourceOutput',
};

const VIEW_MEMBERS = ['mapping', 'input', 'output'] as const;

export function readRenamedBinding(
  owner: Record<string, unknown> | null | undefined,
  members: RenamedBindingMembers,
): MappingBindingLike {
  const view: MappingBindingLike = {};
  if (!owner) return view;
  for (const member of VIEW_MEMBERS) {
    const value = owner[members[member]];
    if (value !== undefined) view[member] = value;
  }
  return view;
}

export function applyRenamedBinding(
  owner: Record<string, unknown>,
  members: RenamedBindingMembers,
  updater: (binding: MappingBindingLike) => void,
): void {
  const view = readRenamedBinding(owner, members);
  updater(view);
  for (const member of VIEW_MEMBERS) {
    const name = members[member];
    const next = view[member];
    if (next === undefined) {
      if (name in owner) delete owner[name];
    } else if (owner[name] !== next) {
      owner[name] = next;
    }
  }
}
