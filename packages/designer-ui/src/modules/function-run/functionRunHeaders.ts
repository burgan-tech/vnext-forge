/**
 * Pure helpers for the Headers tab (`FunctionRunHeadersTab`) — kept separate
 * from `functionRunPayload.ts`, which reasons about the query/body payload,
 * not the header layer.
 */

/**
 * Drops any header entry whose name is blank or whitespace-only.
 *
 * The Headers tab's per-run `KeyValueEditor` writes `sessionHeaders` straight
 * through on every keystroke, including the instant right after "Add header"
 * appends a still-blank row — see `FunctionRunHeadersTab`'s own doc comment.
 * If that write path filtered blank keys itself, the row a user just added
 * (and has not yet typed a name into) would vanish on the very next render:
 * deriving the KV editor's `pairs` prop back from `sessionHeaders` (a plain
 * `Record<string, string>`) can only ever show what actually made it into
 * the record. This is the same failure mode `shouldResyncFromValue` in
 * `FunctionRunPayloadEditor.tsx` documents for a JSON field, applied to a
 * header row instead — the fix here is the mirror image: never filter in the
 * tab's own `onChange`, and filter only here, at the point headers are about
 * to be merged and actually sent (`FunctionRunShell`'s `headers` memo).
 */
export function sanitizeHeaderRecord(record: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.trim() === '') continue;
    result[key] = value;
  }
  return result;
}

/**
 * Header names present in both the per-run set and the Forge-wide set —
 * exactly the keys where `mergeQuickRunHeaders` lets the per-run value win
 * (`toolWide` is its lowest-priority layer, `sessionHeaders` a higher one).
 *
 * Matched by exact key equality, the same case-sensitive comparison a plain
 * object spread — what `mergeQuickRunHeaders` actually does — uses. A
 * case-insensitive match here would flag an "override" for a pair the merge
 * itself does not treat as colliding at all (both would ride along as
 * separate header entries), which would tell the user the wrong one wins.
 */
export function computeShadowedHeaderKeys(
  sessionHeaders: Record<string, string>,
  toolWideHeaders: Record<string, string>,
): string[] {
  return Object.keys(sessionHeaders).filter((key) => Object.prototype.hasOwnProperty.call(toolWideHeaders, key));
}
