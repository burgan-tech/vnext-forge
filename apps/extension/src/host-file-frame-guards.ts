import * as path from 'node:path';

/**
 * Webview → host frames for binary files (x-storage downloads in QuickRun and
 * the instance monitor). The webview cannot download through a Blob anchor
 * (webview CSP), so the host saves or opens the bytes.
 */
export interface HostBytesFrame {
  type: 'host:save-bytes' | 'host:open-bytes';
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export function isHostBytesFrame(value: unknown): value is HostBytesFrame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.type === 'host:save-bytes' || v.type === 'host:open-bytes') &&
    typeof v.fileName === 'string' &&
    typeof v.mimeType === 'string' &&
    typeof v.contentBase64 === 'string'
  );
}

/** Bare file name; the runtime-supplied name is never trusted as a path. */
export function safeFileName(fileName: string): string {
  const base = path.basename(fileName.replace(/\\/g, '/')).replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim();
  return base === '' || base === '.' || base === '..' ? 'download' : base;
}
