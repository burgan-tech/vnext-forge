/**
 * Snippet-specific re-export of the fuzzy matcher used by the Cmd+P quick
 * switcher. We don't import directly because the quick-switcher module also
 * exports its own internal helpers; we want a stable, snippet-local API.
 *
 * Same scoring rules as `quick-switcher/fuzzyMatch`:
 *   +10 per matched char, +20 first-char bonus, +15 word-boundary bonus,
 *   +5  consecutive bonus, -2 per skipped char.
 */

const WORD_BOUNDARY = /[ \-_./:]/;

export interface SnippetFuzzyMatch {
  score: number;
  indices: number[];
}

export function fuzzyMatchSnippet(query: string, candidate: string): SnippetFuzzyMatch | null {
  if (!query) return { score: 0, indices: [] };
  if (!candidate) return null;

  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let qi = 0;
  let lastMatchedIndex = -1;
  let skipped = 0;

  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] !== q[qi]) {
      skipped++;
      continue;
    }
    indices.push(ci);
    score += 10;

    if (ci === 0) score += 20;
    else if (WORD_BOUNDARY.test(c[ci - 1] ?? '')) score += 15;

    if (lastMatchedIndex === ci - 1) score += 5;
    score -= skipped * 2;

    lastMatchedIndex = ci;
    skipped = 0;
    qi++;
  }

  if (qi < q.length) return null;
  return { score, indices };
}

export function highlightMatches(
  label: string,
  indices: number[],
): Array<{ text: string; highlighted: boolean }> {
  if (indices.length === 0) return [{ text: label, highlighted: false }];
  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  for (let i = 0; i < indices.length; ) {
    const start = indices[i]!;
    let end = start;
    while (i + 1 < indices.length && indices[i + 1] === end + 1) {
      end++;
      i++;
    }
    if (start > cursor) {
      segments.push({ text: label.slice(cursor, start), highlighted: false });
    }
    segments.push({ text: label.slice(start, end + 1), highlighted: true });
    cursor = end + 1;
    i++;
  }
  if (cursor < label.length) segments.push({ text: label.slice(cursor), highlighted: false });
  return segments;
}
