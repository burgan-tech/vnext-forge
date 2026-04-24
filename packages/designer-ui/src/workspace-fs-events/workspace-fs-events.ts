/**
 * Host-agnostic workspace filesystem change notifications.
 *
 * Low-level file APIs (`WorkspaceApi`, `SaveComponentApi`, etc.) emit after
 * successful mutations; host shells (e.g. web SPA) subscribe to refresh UI
 * such as the project file tree.
 */

export type WorkspaceFsChangeKind = 'write' | 'delete' | 'mkdir' | 'rename' | 'scaffold';

export interface WorkspaceFsChangeEvent {
  kind: WorkspaceFsChangeKind;
  paths: string[];
  source?: string;
}

export type WorkspaceFsChangeListener = (event: WorkspaceFsChangeEvent) => void;

const listeners = new Set<WorkspaceFsChangeListener>();

export function subscribeWorkspaceFsChange(listener: WorkspaceFsChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitWorkspaceFsChange(event: WorkspaceFsChangeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* isolate listener failures */
    }
  }
}

/** For tests / teardown. */
export function resetWorkspaceFsChangeListeners(): void {
  listeners.clear();
}
