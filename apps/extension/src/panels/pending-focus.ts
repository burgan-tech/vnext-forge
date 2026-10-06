/**
 * Focus requests that arrived for a Quick Run panel that is not open yet.
 * `openQuickRunFromFile` returns before the panel exists, so the request is
 * parked here and claimed by `QuickRunPanel.open` for the same workflow key.
 * Only the latest request per key is kept.
 */
export class PendingFocusStore {
  private readonly byKey = new Map<string, string>();

  set(key: string, instanceId: string): void {
    this.byKey.set(key, instanceId);
  }

  /** Returns and removes the parked instance id, if any. */
  take(key: string): string | undefined {
    const id = this.byKey.get(key);
    this.byKey.delete(key);
    return id;
  }
}
