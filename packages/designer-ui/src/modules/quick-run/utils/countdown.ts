/**
 * Human countdown: `45s`, `1m 1s`, `1h 2m`, `1d 1h`. Rounds UP to the next
 * second so a positive remainder never reads `0s`.
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const total = Math.ceil(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Label for an engine-scheduled instant (timeout, scheduled transition):
 * `in 4m 10s` while in the future, `Settling…` once due (the runtime fires it
 * shortly after), `null` when the value does not parse.
 */
export function scheduleCountdownLabel(executeAtUtc: string, nowMs: number): string | null {
  const at = Date.parse(executeAtUtc);
  if (Number.isNaN(at)) return null;
  const left = at - nowMs;
  return left > 0 ? `in ${formatCountdown(left)}` : 'Settling…';
}
