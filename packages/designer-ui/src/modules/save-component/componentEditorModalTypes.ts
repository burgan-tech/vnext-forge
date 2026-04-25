import type { ComponentEditorTargetKind } from '../vnext-workspace/resolveComponentEditorRoute.js';

/** Top-level vNext component JSON fields after a successful save (for workflow ref sync). */
export interface AtomicSavedInfo {
  key: string;
  version: string;
  domain: string;
  flow: string;
}

export interface ComponentEditorTarget {
  kind: ComponentEditorTargetKind;
  projectId: string;
  group: string;
  name: string;
  /** Fires once after save writes JSON to disk, from the in-memory document snapshot. */
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
}
