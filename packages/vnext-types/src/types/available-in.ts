import type { RoleGrant } from './role';

/**
 * One `availableIn` item in its object form — a state key optionally narrowed
 * by role.
 *
 * `roles` composes with the transition's own `roles` as an **AND**: the
 * transition's grants are the global gate, these narrow it further while the
 * instance sits in this one state. An entry with no `roles` adds no narrowing,
 * which is why it is exactly equivalent to the bare string form.
 */
export interface AvailableInEntry {
  state: string;
  roles?: RoleGrant[];
}

/**
 * A single authored `availableIn` item. The two forms may be mixed freely
 * within one array.
 */
export type AvailableInItem = string | AvailableInEntry;

/**
 * States where a transition is available. Empty or absent means **every**
 * state.
 *
 * Supported on shared transitions (Manual only) and on the `cancel`, `exit`
 * and `updateData` lifecycle transitions. Read and written through the codec
 * in `utils/available-in` so the parse and write rules cannot drift apart.
 */
export type AvailableIn = AvailableInItem[];
