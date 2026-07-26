import type { ActiveScript } from '../code-editor/ScriptPanelStore.js';

/**
 * Canonical state-key derivation for a task component, shared between
 * `TaskEditorPanel` (which threads it into `CsxEditorField`'s `stateKey`
 * prop, via `CacheAsideTaskForm`) and `TaskEditorView`'s script-panel
 * persistence guard. Keeping this in one place prevents the two call
 * sites from silently drifting apart — a drift would let the guard
 * either reject a legitimately-open script or, worse, accept a stale
 * one carried over from a different task.
 */
export function deriveTaskStateKey(json: { key?: unknown } | null | undefined): string {
  const key = json?.key;
  return (typeof key === 'string' && key) || 'task';
}

/**
 * Pure decision: should this bottom-panel script edit be written into the
 * CURRENTLY loaded task's `attributes.config.sourceMapping`?
 *
 * Guards against a cross-task clobber: `useScriptPanelStore.activeScript`
 * and `useEditorPanelsStore.scriptPanelOpen` are global singletons, and
 * `TaskEditorView` can stay mounted across in-app navigation between
 * tasks (the route has no remount key). Without this check, a script
 * opened while editing Task A's Source Mapping would get persisted into
 * Task B's JSON the moment the user navigated to Task B without closing
 * the panel first.
 */
export function shouldPersistCacheAsideSourceMapping(
  script: Pick<ActiveScript, 'listField' | 'scriptField' | 'stateKey'>,
  currentTaskStateKey: string,
): boolean {
  return (
    script.listField === 'attributes' &&
    script.scriptField === 'config.sourceMapping' &&
    script.stateKey === currentTaskStateKey
  );
}
