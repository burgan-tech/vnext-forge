import { useEffect } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import { executionModeNote, resolveEffectiveExecutionMode, type EffectiveExecutionMode } from '../utils/executionMode';
import { useRuntimeSupports } from '../utils/runtimeFeatures';

export interface DefinedExecutionMode {
  mode: EffectiveExecutionMode | null;
  /** Runtime 0.0.99+ honours the definition, so the sync toggle is fixed. */
  locked: boolean;
  /** Explanation shown under the toggle; null when the definition is silent. */
  note: string | null;
}

/**
 * The definition's `executionType` for a start (`transitionKey === null`) or
 * a transition. While `open`, it seeds the dialog's sync toggle; on a runtime
 * that honours it (0.0.99+) the toggle is locked, on an older or unknown
 * runtime it is only the default, since those still follow `?sync=`.
 */
export function useDefinedExecutionMode(
  transitionKey: string | null,
  open: boolean,
  setSync: (sync: boolean) => void,
): DefinedExecutionMode {
  const types = useQuickRunStore((s) => s.flowExecutionTypes);
  const fromState = useQuickRunStore((s) => s.activeState?.state);
  const supports = useRuntimeSupports('executionType');
  const mode = resolveEffectiveExecutionMode(types, transitionKey, transitionKey === null ? undefined : fromState);
  const locked = !!mode && supports === true;

  const modeSync = mode?.sync;
  useEffect(() => {
    if (open && modeSync !== undefined) setSync(modeSync);
  }, [open, modeSync, transitionKey, setSync]);

  let note: string | null = null;
  if (mode) {
    note = executionModeNote(mode);
    if (!locked) {
      note += supports === false ? ' This runtime predates 0.0.99 and still follows the toggle.' : ' Applies on runtime 0.0.99+.';
    }
  }
  return { mode, locked, note };
}
