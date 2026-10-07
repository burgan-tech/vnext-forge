import { ERROR_CODES } from '@vnext-forge-studio/app-contracts';

import type { DataHistoryItem, getDataHistory } from '../../quick-run/QuickRunApi';
import type { RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';

export type DataPageOutcome =
  | { kind: 'page'; items: DataHistoryItem[]; hasNext: boolean }
  | { kind: 'unavailable' }
  | { kind: 'error'; error: RuntimeErrorLike };

/** Maps a `getDataHistory` response onto what the hook does with it. */
export function outcomeOf(res: Awaited<ReturnType<typeof getDataHistory>>): DataPageOutcome {
  if (res.success) return { kind: 'page', items: res.data.items, hasNext: res.data.hasNext };
  if (res.error.code === ERROR_CODES.RUNTIME_NOT_FOUND) return { kind: 'unavailable' };
  return { kind: 'error', error: res.error };
}

/** Appends an older page, dropping rows already loaded. */
export function appendPage(prev: DataHistoryItem[], items: DataHistoryItem[]): DataHistoryItem[] {
  const seen = new Set(prev.map((r) => r.id));
  return [...prev, ...items.filter((r) => !seen.has(r.id))];
}

/** Fresh first page plus the already-loaded rows older than it, newest first. */
export function mergeFirstPage(prev: DataHistoryItem[], fresh: DataHistoryItem[]): DataHistoryItem[] {
  if (fresh.length === 0) return [];
  const oldest = Math.min(...fresh.map((r) => Date.parse(r.enteredAt)));
  const seen = new Set(fresh.map((r) => r.id));
  const older = prev.filter((r) => !seen.has(r.id) && Date.parse(r.enteredAt) <= oldest);
  return [...fresh, ...older];
}
