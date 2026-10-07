import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

function owner(
  row: DataHistoryItem,
  history: HistoryTransition[],
  now: number,
): HistoryTransition | null {
  const t = Date.parse(row.enteredAt);
  const containing = history.filter((h) => {
    const end = h.finishedAt ? Date.parse(h.finishedAt) : now;
    return t >= Date.parse(h.startedAt) && t <= end;
  });
  // A row stamped exactly on a firing's start belongs to the earlier firing when one still contains it
  // (chained automatic transitions inside the same millisecond).
  const earlier = containing.filter((h) => Date.parse(h.startedAt) < t);
  const pool = earlier.length > 0 ? earlier : containing;
  let best: HistoryTransition | null = null;
  let bestStart = -Infinity;
  for (const h of pool) {
    const start = Date.parse(h.startedAt);
    if (start >= bestStart) {
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

/** `v{version} #{versionNo}`: VersionNo restarts per version line, so both parts identify a row. */
export function rowLabel(row: DataHistoryItem): string {
  return `v${row.version} #${row.versionNo}`;
}

/** Orders two rows oldest first by `enteredAt`; ties fall back to position in the newest-first `rows`. */
export function compareOrder(
  rows: DataHistoryItem[],
  a: DataHistoryItem,
  b: DataHistoryItem,
): [DataHistoryItem, DataHistoryItem] {
  const dt = Date.parse(a.enteredAt) - Date.parse(b.enteredAt);
  if (dt !== 0) return dt < 0 ? [a, b] : [b, a];
  return rows.findIndex((r) => r.id === a.id) > rows.findIndex((r) => r.id === b.id) ? [a, b] : [b, a];
}

/** True when the firing began before the oldest loaded row and older pages exist, so its rows may be unloaded. */
export function firingDataMayBeUnloaded(
  firing: HistoryTransition,
  rows: DataHistoryItem[],
  hasNext: boolean,
): boolean {
  if (!hasNext || rows.length === 0) return false;
  const oldest = Math.min(...rows.map((r) => Date.parse(r.enteredAt)));
  return Date.parse(firing.startedAt) < oldest;
}
