import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

function owner(
  row: DataHistoryItem,
  history: HistoryTransition[],
  now: number,
): HistoryTransition | null {
  const t = Date.parse(row.enteredAt);
  let best: HistoryTransition | null = null;
  let bestStart = -Infinity;
  for (const h of history) {
    const start = Date.parse(h.startedAt);
    const end = h.finishedAt ? Date.parse(h.finishedAt) : now;
    if (t >= start && t <= end && start >= bestStart) {
      best = h;
      bestStart = start;
    }
  }
  return best;
}

/** Group data rows by the history firing whose window contains them (latest-starting wins). */
export function attributeRows(
  rows: DataHistoryItem[],
  history: HistoryTransition[],
  now: number = Date.now(),
): Map<string, DataHistoryItem[]> {
  const map = new Map<string, DataHistoryItem[]>();
  for (const row of rows) {
    const h = owner(row, history, now);
    if (!h) continue;
    const list = map.get(h.id);
    if (list) list.push(row);
    else map.set(h.id, [row]);
  }
  return map;
}

/** Rows that fall outside every firing window. */
export function otherWrites(
  rows: DataHistoryItem[],
  history: HistoryTransition[],
  now: number = Date.now(),
): DataHistoryItem[] {
  return rows.filter((row) => !owner(row, history, now));
}

/** Next older row in a newest-first list. */
export function previousRow(rows: DataHistoryItem[], row: DataHistoryItem): DataHistoryItem | null {
  const i = rows.findIndex((r) => r.id === row.id);
  return i >= 0 && i + 1 < rows.length ? rows[i + 1] : null;
}
