const LIVE = new Set(['A', 'B']);
export const POLL_FAST_MS = 3000;
export const POLL_SLOW_MS = 10_000;
export const POLL_BACKOFF_AFTER_MS = 60_000;

/** Delay before the next freshness check, or null when the monitor should not poll. */
export function nextPollDelay(input: { status: string | undefined; unchangedForMs: number; visible: boolean; paused: boolean }): number | null {
  if (input.paused || !input.visible || !input.status || !LIVE.has(input.status)) return null;
  return input.unchangedForMs >= POLL_BACKOFF_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
}

interface FingerprintSource {
  modifiedAt?: string | null;
  status?: string;
  currentState?: string;
  effectiveState?: string;
}

/** Cheap change signal for an instance; works when the runtime omits `modifiedAt`. */
export function instanceFingerprint(metadata: FingerprintSource): string {
  return [metadata.modifiedAt ?? '', metadata.status ?? '', metadata.currentState ?? '', metadata.effectiveState ?? ''].join('|');
}

/** A poll tick refreshes only when the instance differs from what is on screen. */
export function pollNeedsRefresh(shownFingerprint: string, fetchedFingerprint: string): boolean {
  return shownFingerprint !== fetchedFingerprint;
}

/** Bus events refresh only matching instances, and never while live updates are paused. */
export function shouldRefreshFromBus(levelIds: readonly string[], instanceId: string, paused: boolean): boolean {
  return !paused && levelIds.includes(instanceId);
}
