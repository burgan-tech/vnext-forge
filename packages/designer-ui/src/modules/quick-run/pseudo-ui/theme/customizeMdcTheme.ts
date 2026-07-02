/**
 * Replace every MDC theme hex with the brand-equivalent hex.
 *
 * Pure string transform. Used by buildSheets.getBaseSheet() to produce
 * a brand-aware version of PrimeReact's MDC theme CSS at runtime.
 *
 * Performance: a 60KB MDC theme + ~300 hex entries finishes in <10ms
 * on typical hardware. We cache the result keyed by replacement-set
 * identity in buildSheets, so the swap runs at most once per brand
 * change, not per render.
 */

/**
 * @param rawCss        — the original PrimeReact MDC theme CSS string
 * @param replacements  — hex → hex map produced by
 *                        derivePrimeReactReplacements()
 */
export function customizeMdcTheme(
  rawCss: string,
  replacements: Record<string, string>,
): string {
  let result = rawCss;
  for (const [oldHex, newHex] of Object.entries(replacements)) {
    // Plain substring replace — hex strings are exactly 7 chars and
    // cannot accidentally match other CSS tokens.
    result = result.split(oldHex).join(newHex);
  }
  return result;
}

/**
 * Fast identity hash of a replacement map — for cache keys in
 * buildSheets. We don't need a cryptographic hash, just enough to
 * distinguish different brand JSON outputs.
 *
 * Concat-then-hash strategy: ~40 chars per entry × 300 entries ≈ 12KB
 * string, single djb2 pass. Stable across renders because the input
 * keys come from a deterministic source (mdcRoleMap.json).
 */
export function hashReplacements(replacements: Record<string, string>): string {
  let hash = 5381;
  for (const [k, v] of Object.entries(replacements)) {
    const s = k + ':' + v + ';';
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
    }
  }
  return hash.toString(36);
}
