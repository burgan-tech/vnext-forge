/**
 * The runtime's built-in `file` function (runtime 0.0.100): the bytes of an
 * `x-storage` file stored in an instance's data.
 *
 *   GET|HEAD /{domain}/workflows/{workflow}/instances/{instance}/functions/file?file=<guid>
 *
 * It has no `/info`, no contract and a binary body, so the Function Run
 * screen does not drive it through `/info` → `functions/invoke` (a text-only
 * path). It reuses `quickrun/downloadFile`, the binary-safe RPC the Quick Run
 * file chips already call.
 */
import type { FunctionCatalogEntry } from '../quick-run/types/quickrun.types';
import { formatBytes } from '../quick-run/utils/fileFields';

/** The reserved key of the built-in function (see `reservedFunctionKeys`). */
export const FILE_FUNCTION_KEY = 'file';

export function isFileFunction(functionKey: string): boolean {
  return functionKey === FILE_FUNCTION_KEY;
}

/** The catalog row Quick Run lists for the built-in; the engine's catalog omits it. */
export const FILE_FUNCTION_CATALOG_ENTRY: FunctionCatalogEntry = {
  name: FILE_FUNCTION_KEY,
  version: '',
  scope: 'I',
  href: '',
  labels: [{ language: 'en', label: 'Built-in: stored file' }],
};

/**
 * The instance's function catalog with the built-in `file` function added
 * when the runtime has it (`supported` is `false` only for a runtime known to
 * be older than 0.0.100; an unknown version still offers it). Returns the
 * catalog unchanged otherwise, including `null` for "not fetched".
 */
export function withBuiltInFileFunction(
  entries: readonly FunctionCatalogEntry[] | null,
  supported: boolean | undefined,
): readonly FunctionCatalogEntry[] | null {
  if (supported === false) return entries;
  const list = entries ?? [];
  if (list.some((entry) => isFileFunction(entry.name))) return entries;
  return [...list, FILE_FUNCTION_CATALOG_ENTRY];
}

export interface FileFunctionTarget {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** The handle's `file` id. */
  file: string;
}

function segment(value: string, placeholder: string): string {
  const trimmed = value.trim();
  return trimmed === '' ? placeholder : encodeURIComponent(trimmed);
}

/** The path the request goes to, for the endpoint bar; blanks show as named placeholders. */
export function buildFileFunctionEndpoint(target: FileFunctionTarget): string {
  const wf = segment(target.workflowKey, '{workflowKey}');
  const id = segment(target.instanceId, '{instanceId}');
  const file = segment(target.file, '{file}');
  return `/api/v1/${target.domain}/workflows/${wf}/instances/${id}/functions/file?file=${file}`;
}

/** Why Send is disabled, or `null` when the request can go out. */
export function fileFunctionInvokeBlocker(target: FileFunctionTarget): string | null {
  if (target.workflowKey.trim() === '' || target.instanceId.trim() === '') {
    return 'Enter the workflow key and instance id.';
  }
  if (target.file.trim() === '') return 'Enter the file id from a stored file handle.';
  return null;
}

/** `quickrun/downloadFile`'s result — mirrors `DownloadedFile` in `QuickRunApi`. */
export interface FileFunctionResponse {
  contentBase64: string;
  contentType: string;
  size: number;
  fileName?: string;
  eTag?: string;
}

export interface FileFunctionResultView {
  fileName: string;
  /** `contentType` with a fallback for an empty header. */
  mimeType: string;
  sizeLabel: string;
  eTag: string | null;
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * What the response pane shows. The name comes from `Content-Disposition`;
 * a response without one falls back to the file id, so Save as never offers
 * an empty name.
 */
export function describeFileFunctionResult(
  response: FileFunctionResponse,
  fileId: string,
): FileFunctionResultView {
  return {
    fileName: nonBlank(response.fileName) ?? nonBlank(fileId) ?? 'file',
    mimeType: nonBlank(response.contentType) ?? 'application/octet-stream',
    sizeLabel: formatBytes(response.size),
    eTag: nonBlank(response.eTag) ?? null,
  };
}
