/**
 * `x-storage` file fields (vnext-schema 0.0.56 / runtime 0.0.100).
 *
 * - Upload: the client sends `{ name, mimeType, size, content }` (base64) at
 *   the field's path in the start / transition body; no multipart.
 * - The runtime stores the bytes in a blob binding and keeps a handle
 *   `{ component, file, name, mimeType, size, eTag, owner }` in the data.
 * - Keep: echoing `{ file }` (or the handle) without `content` keeps a stored
 *   file; an echo is refused on start.
 * - Download: `GET …/instances/{owner.instance}/functions/file?file=<guid>`.
 *
 * Transition schemas carry no `x-storage` (input roles refuse it), so file
 * fields are found from the workflow's master schema, with a shape fallback.
 */

/** Kestrel's 10 MiB request limit leaves about 7.5 MiB of file after base64. */
export const MAX_UPLOAD_BYTES = Math.floor(7.5 * 1024 * 1024);

export interface FileUploadValue {
  name: string;
  mimeType: string;
  size: number;
  content: string;
}

export interface FileHandle {
  component?: string;
  file: string;
  name?: string;
  mimeType?: string;
  size?: number;
  eTag?: string;
  owner?: { domain?: string; flow?: string; instance?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Dotted paths of the master schema's file fields: `doc`, `files[]`,
 * `documents[].doc` (one array level, as the runtime allows).
 */
export function storageFieldPaths(masterSchemaRoot: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown, path: string, arrays: number): void => {
    if (!isRecord(node)) return;
    if (path !== '' && node['x-storage'] !== undefined) {
      out.push(path);
      return;
    }
    if (isRecord(node.properties)) {
      for (const [key, child] of Object.entries(node.properties)) walk(child, path ? `${path}.${key}` : key, arrays);
    }
    if (arrays === 0 && isRecord(node.items) && path !== '') walk(node.items, `${path}[]`, arrays + 1);
  };
  walk(masterSchemaRoot, '', 0);
  return out;
}

/** Form path (`a.b`, `list.0.doc`) → schema path (`a.b`, `list[].doc`). */
export function toSchemaPath(formPath: string): string {
  return formPath
    .split('.')
    .map((segment) => (/^\d+$/.test(segment) ? '[]' : segment))
    .join('.')
    .replace(/\.\[\]/g, '[]');
}

/**
 * Whether the form node at `formPath` is a file upload: its schema path is a
 * master `x-storage` field, or it has the upload shape (`content` + `name`).
 */
export function isFileUploadNode(node: unknown, formPath: string, masterPaths: readonly string[]): boolean {
  if (!isRecord(node) || (node.type !== undefined && node.type !== 'object')) return false;
  if (masterPaths.includes(toSchemaPath(formPath))) return true;
  const props = isRecord(node.properties) ? node.properties : {};
  return props.content !== undefined && props.name !== undefined;
}

/** A stored file handle (what reads return in place of the bytes). */
export function isFileHandle(value: unknown): value is FileHandle {
  return (
    isRecord(value) &&
    typeof value.file === 'string' &&
    value.file !== '' &&
    value.content === undefined &&
    (typeof value.eTag === 'string' || typeof value.component === 'string' || isRecord(value.owner))
  );
}

/** Every file handle in instance data, with its dotted path. */
export function collectFileHandles(data: unknown): { path: string; handle: FileHandle }[] {
  const out: { path: string; handle: FileHandle }[] = [];
  const walk = (value: unknown, path: string): void => {
    if (isFileHandle(value)) {
      out.push({ path, handle: value });
      return;
    }
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index)));
    else if (isRecord(value)) for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
  };
  walk(data, '');
  return out;
}

/** Bytes → base64 (chunked, so large files do not overflow the call stack). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Reads a picked file into the upload shape the runtime expects. */
export async function fileToUploadValue(file: File): Promise<FileUploadValue> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    content: bytesToBase64(bytes),
  };
}

export function formatBytes(size: number | undefined): string {
  if (typeof size !== 'number' || !Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
