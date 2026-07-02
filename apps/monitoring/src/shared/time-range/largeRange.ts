export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/** True when [from, to] spans strictly more than 30 days. */
export function rangeExceeds30Days(resolved: { from: string; to: string }): boolean {
  return new Date(resolved.to).getTime() - new Date(resolved.from).getTime() > THIRTY_DAYS_MS
}
