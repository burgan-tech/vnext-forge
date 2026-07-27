import { extractEtag } from '../etagFromResponse';
import type { DataResponse } from '../types/quickrun.types';

type GetDataApiResponse =
  | { success: true; data: DataResponse }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export type DataOutcome =
  | { kind: 'keep' }
  | { kind: 'update'; data: DataResponse; etag: string | undefined }
  | { kind: 'clear' };

/**
 * Pure decision for how a conditional `getData` response should update the
 * store. Mirrors the conditional-Data pattern already used by
 * `scheduleQuickRunRefresh`:
 * - Engine/network failure -> `clear` (drop both `activeData` and its
 *   cached ETag so the next attempt is unconditional instead of getting
 *   stuck echoing a stale-but-still-valid ETag forever).
 * - HTTP 304 (`notModified`) -> `keep` (leave the current cache as-is).
 * - Fresh 200 -> `update` with the new data + freshly extracted ETag.
 */
export function decideDataOutcome(response: GetDataApiResponse): DataOutcome {
  if (!response.success) return { kind: 'clear' };
  if (response.data.notModified) return { kind: 'keep' };
  return { kind: 'update', data: response.data, etag: extractEtag(response.data) };
}
