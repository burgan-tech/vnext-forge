export interface JsonDiff {
  added: { path: string; value: string }[];
  removed: { path: string; value: string }[];
  changed: { path: string; oldValue: string; newValue: string }[];
  unchangedCount: number;
}

const isContainer = (v: unknown): v is Record<string, unknown> | unknown[] =>
  typeof v === 'object' && v !== null;

const show = (v: unknown): string => JSON.stringify(v) ?? 'undefined';

function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function entries(v: Record<string, unknown> | unknown[]): [string | number, unknown][] {
  return Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
}

function collectLeaves(value: unknown, path: string, out: { path: string; value: string }[]): void {
  if (isContainer(value)) {
    for (const [k, v] of entries(value)) collectLeaves(v, childPath(path, k), out);
    return;
  }
  out.push({ path, value: show(value) });
}

function walk(before: unknown, after: unknown, path: string, diff: JsonDiff): void {
  const bc = isContainer(before);
  const ac = isContainer(after);
  if (bc && ac && Array.isArray(before) === Array.isArray(after)) {
    const b = new Map(entries(before));
    const a = new Map(entries(after));
    for (const [k, v] of b) {
      const p = childPath(path, k);
      if (a.has(k)) walk(v, a.get(k), p, diff);
      else collectLeaves(v, p, diff.removed);
    }
    for (const [k, v] of a) {
      if (!b.has(k)) collectLeaves(v, childPath(path, k), diff.added);
    }
    return;
  }
  if (bc || ac) {
    diff.changed.push({ path, oldValue: show(before), newValue: show(after) });
    return;
  }
  if (Object.is(before, after)) diff.unchangedCount += 1;
  else diff.changed.push({ path, oldValue: show(before), newValue: show(after) });
}

export function diffJson(before: unknown, after: unknown): JsonDiff {
  const diff: JsonDiff = { added: [], removed: [], changed: [], unchangedCount: 0 };
  if (before === undefined || before === null) {
    collectLeaves(after, '', diff.added);
    return diff;
  }
  walk(before, after, '', diff);
  return diff;
}
