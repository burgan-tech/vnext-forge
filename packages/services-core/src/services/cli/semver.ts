/**
 * Minimal core-semver helpers for `wf --version` and npm dist-tag comparisons.
 * Kept dependency-free: the CLI prints plain `x.y.z`, npm dist-tags are `x.y.z`.
 */

/** First core semver matched in a version string ("v1.2.3", "wf 2.0.0", …). */
export function extractCoreSemver(raw: string): string | null {
  const trimmed = raw.trim()
  const m =
    /\bv?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\b/.exec(trimmed) ??
    /\b(\d+\.\d+\.\d+)\b/.exec(trimmed)
  return m?.[1] ?? null
}

/** Compare two core semver strings (x.y.z). Returns positive if `a` is greater than `b`. */
export function compareCoreSemver(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10))
  const pb = b.split('.').map((x) => Number.parseInt(x, 10))
  if (pa.length !== 3 || pb.length !== 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) {
    return a.localeCompare(b)
  }
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
      return (pa[i] ?? 0) - (pb[i] ?? 0)
    }
  }
  return 0
}
