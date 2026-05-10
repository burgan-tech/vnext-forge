/**
 * Lightweight VS-Code-style fuzzy matcher. Pure function — given a query and
 * a candidate, returns either `null` (no match) or a score + the indices of
 * the matched characters in the candidate so the renderer can highlight them.
 *
 * Scoring heuristic (higher is better):
 *   +10  for each matched character
 *   +20  bonus when the match is at index 0
 *   +15  bonus when the match starts a word (preceded by space, '-', '_', '/', '.')
 *   +5   bonus when the match is consecutive with the previous match
 *   -2   penalty per skipped character between matches
 *
 * Empty query returns score 0 with no indices — caller decides whether to
 * include such entries (typical: yes, sorted by their natural order).
 */

const WORD_BOUNDARY = /[ \-_./:]/;

export interface FuzzyMatch {
  score: number;
  indices: number[];
}

export function fuzzyMatch(query: string, candidate: string): FuzzyMatch | null {
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

/**
 * Splits a label into highlighted/plain segments based on `indices`.
 * Renderer turns highlighted segments bold/coloured.
 */
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
    // group consecutive indices into a single highlighted span
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
  if (cursor < label.length) {
    segments.push({ text: label.slice(cursor), highlighted: false });
  }
  return segments;
}
