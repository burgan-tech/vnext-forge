import type { ResolvedRange } from './time-range-types'

/**
 * Converts a resolved time range into a GraphQL-style filter JSON string
 * that filters instances by createdAt within [from, to].
 *
 * Output: {"and":[{"createdAt":{"ge":"<ISO>"}},{"createdAt":{"le":"<ISO>"}}]}
 */
export function buildTimeRangeFilter(resolved: ResolvedRange): string | undefined {
  if (!resolved.from || !resolved.to) return undefined
  return JSON.stringify({
    and: [
      { createdAt: { ge: resolved.from } },
      { createdAt: { le: resolved.to } },
    ],
  })
}

/**
 * Merges two serialized filter JSON strings under a single `and` group.
 * Flattens top-level `and` arrays from both sides to avoid nesting.
 *
 * - Both present → {"and":[...conditions from a, ...conditions from b]}
 * - One absent   → returns the other unchanged
 * - Both absent  → returns undefined
 */
function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return null
  }
}

export function mergeFilters(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  if (!a && !b) return undefined
  if (!a) return b
  if (!b) return a

  const objA = safeParse(a)
  const objB = safeParse(b)

  // If either side fails to parse, fall back to returning the other
  if (!objA) return b
  if (!objB) return a

  const condA = Array.isArray(objA['and']) ? (objA['and'] as unknown[]) : [objA]
  const condB = Array.isArray(objB['and']) ? (objB['and'] as unknown[]) : [objB]

  return JSON.stringify({ and: [...condA, ...condB] })
}
